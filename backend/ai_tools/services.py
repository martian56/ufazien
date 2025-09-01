import os
import time
import json
import logging
from typing import Dict, Any, Optional
from django.conf import settings
from openai import AzureOpenAI
from .models import AITask, HumanizerTask, TaskStatus, WritingStyle

logger = logging.getLogger(__name__)

class AIService:
    """Service class for handling AI operations with Azure OpenAI"""
    
    def __init__(self):
        # Check if all required settings are available
        if not all([
            settings.AZURE_OPENAI_ENDPOINT,
            settings.AZURE_OPENAI_API_KEY,
            settings.AZURE_OPENAI_API_VERSION,
            settings.AZURE_OPENAI_DEPLOYMENT_NAME
        ]):
            raise ValueError("Missing Azure OpenAI configuration. Please check your environment variables.")
        
        logger.info(f"Initializing Azure OpenAI client with endpoint: {settings.AZURE_OPENAI_ENDPOINT}")
        logger.info(f"Using deployment: {settings.AZURE_OPENAI_DEPLOYMENT_NAME}")
        
        self.client = AzureOpenAI(
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_key=settings.AZURE_OPENAI_API_KEY,
            api_version=settings.AZURE_OPENAI_API_VERSION
        )
        self.deployment_name = settings.AZURE_OPENAI_DEPLOYMENT_NAME
        
    def humanize_text(self, task: AITask) -> str:
        """
        Humanization pipeline: rewrites AI-generated text to pass as 100% human-written.
        Uses style prompts + randomness + post-processing quirks to reduce AI detectability.
        """
        try:
            humanizer_task = getattr(task, "humanizer_details", None)
            if not humanizer_task:
                raise ValueError("Humanizer task details not found")

            # Style presets with more natural imperfection baked in
            style_prompts = {
                WritingStyle.NATURAL: "Rewrite this like you’re talking to a friend—loose, warm, slightly messy.",
                WritingStyle.ACADEMIC: "Rewrite like a grad student pulling an all-nighter: smart, a bit rough around the edges, not robotic.",
                WritingStyle.CASUAL: "Rewrite casually, like a blog post or late-night ramble, with little asides.",
                WritingStyle.PROFESSIONAL: "Rewrite in a business-professional tone—clear and confident, but still human.",
                WritingStyle.CREATIVE: "Rewrite with imagination and personal voice—quirky, unexpected turns allowed."
            }

            style_instruction = style_prompts.get(
                humanizer_task.writing_style,
                style_prompts[WritingStyle.NATURAL]
            )

            # Core humanizer prompt
            prompt = f"""
    You are not an AI—you are a human ghostwriter. Rewrite the text so it feels
    completely human: authentic, slightly unpredictable, and not machine-polished.

    Guidelines (don’t follow like a checklist, just keep in mind):
    - {style_instruction}
    - Use natural rhythms: short bursts + longer reflections
    - Throw in contractions, casual connectors ("anyway", "honestly", "to be fair")
    - Allow fragments, tangents, or asides (like real people)
    - Avoid robotic transitions (no "In conclusion", "Overall", etc.)
    - Imperfection is good—don’t make grammar spotless
    - Never label output as rewritten text; just write it
    """

            if humanizer_task.target_tone:
                prompt += f"\nTone: Keep a consistent {humanizer_task.target_tone} tone."

            if humanizer_task.preserve_formatting:
                prompt += "\nPreserve the original formatting and paragraph breaks."

            prompt += f"\n\nOriginal text:\n{task.input_text}"

            logger.info(f"Calling Azure OpenAI for humanization task {task.id}")
            logger.debug(f"Deployment: {self.deployment_name}")

            try:
                response = self.client.chat.completions.create(
                    model=self.deployment_name,
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You are a human editor. Rewrite text so well that no AI detector"
                                " can flag it. Write with quirks, rhythm, and voice—the way a real person would."
                            )
                        },
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.99,        # more randomness for unpredictability
                    max_tokens=4000,
                    top_p=0.97,             # widen vocabulary diversity
                    frequency_penalty=0.7,  # suppress repetition patterns
                    presence_penalty=0.65   # encourage fresh phrasing
                )
            except Exception as e:
                logger.error(f"Azure OpenAI API call failed for task {task.id}: {str(e)}")
                raise

            humanized_text = response.choices[0].message.content.strip()

            # --- Post-processing tweaks (to break detector patterns further) ---
            import random, re

            tweaks = [
                # Replace overly AI-ish connectors with looser phrasing
                lambda t: re.sub(r"\bfor example\b", random.choice(["say", "like", "let’s say"]), t, 1) if "for example" in t else t,
                lambda t: re.sub(r"\bIn conclusion\b", random.choice(["So yeah, to wrap it up", "Anyway, bottom line is", "Long story short"]), t, 1) if "In conclusion" in t else t,

                # Randomly insert a subtle human aside
                lambda t: t + random.choice([
                    "\n\n(That’s just how I see it, anyway.)",
                    "\n\nWeird side note, but it felt worth saying.",
                    "\n\nAnyway—take that for what it’s worth."])
                if random.random() < 0.25 else t
            ]

            for tweak in tweaks:
                humanized_text = tweak(humanized_text)

            # Occasionally shuffle sentence order in a paragraph (small human-like imperfection)
            if random.random() < 0.15:
                paragraphs = humanized_text.split("\n")
                shuffled = []
                for p in paragraphs:
                    sentences = re.split(r'(?<=[.!?]) +', p)
                    if len(sentences) > 2:
                        random.shuffle(sentences)
                    shuffled.append(" ".join(sentences))
                humanized_text = "\n".join(shuffled)

            logger.info(f"Successfully humanized text for task {task.id}")
            return humanized_text

        except Exception as e:
            logger.error(f"Humanization failed for task {task.id}: {str(e)}")
            raise




    def paraphrase_text(self, task: AITask) -> str:
        """
        Paraphrase text while maintaining meaning
        """
        try:
            prompt = f"""
Paraphrase the following text while maintaining its original meaning. 
Use different words and sentence structures, but keep the core message intact.
Make the output natural and well-written.

Text to paraphrase:
{task.input_text}
"""
            
            response = self.client.chat.completions.create(
                model=self.deployment_name,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at paraphrasing text while maintaining meaning and improving clarity."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.8,
                max_tokens=4000
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Error paraphrasing text for task {task.id}: {str(e)}")
            raise

    def summarize_text(self, task: AITask) -> str:
        """
        Create a concise summary of the text
        """
        try:
            word_count = len(task.input_text.split())
            
            # Determine summary length based on input length
            if word_count > 1000:
                summary_instruction = "Create a comprehensive summary (200-300 words)"
            elif word_count > 500:
                summary_instruction = "Create a moderate summary (100-200 words)"
            else:
                summary_instruction = "Create a brief summary (50-100 words)"
            
            prompt = f"""
{summary_instruction} of the following text. 
Capture the key points, main arguments, and essential information.
Make the summary clear, coherent, and well-structured.

Text to summarize:
{task.input_text}
"""
            
            response = self.client.chat.completions.create(
                model=self.deployment_name,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at creating clear, concise summaries that capture the essential information from longer texts."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.5,
                max_tokens=2000
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Error summarizing text for task {task.id}: {str(e)}")
            raise

    def check_grammar(self, task: AITask) -> str:
        """
        Check and correct grammar, spelling, and style
        """
        try:
            prompt = f"""
Check and correct the following text for:
- Grammar errors
- Spelling mistakes
- Punctuation issues
- Style improvements
- Clarity and readability

Provide the corrected text along with a brief explanation of major changes made.

Text to check:
{task.input_text}
"""
            
            response = self.client.chat.completions.create(
                model=self.deployment_name,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert grammar checker and writing assistant. You help improve text quality while preserving the author's voice."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=4000
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Error checking grammar for task {task.id}: {str(e)}")
            raise

    def process_task(self, task: AITask) -> str:
        """
        Main method to process tasks based on tool type
        """
        processors = {
            'humanizer': self.humanize_text,
            'paraphraser': self.paraphrase_text,
            'summarizer': self.summarize_text,
            'grammar_checker': self.check_grammar,
        }
        
        processor = processors.get(task.tool_type)
        if not processor:
            raise ValueError(f"Unknown tool type: {task.tool_type}")
        
        return processor(task)

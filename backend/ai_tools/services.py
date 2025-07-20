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
        Advanced humanization method for rewriting AI-generated text to appear 100% human-written.
        Optimized to evade all AI detectors (e.g., QuillBot, Originality.ai).
        """
        try:
            humanizer_task = getattr(task, 'humanizer_details', None)
            if not humanizer_task:
                raise ValueError("Humanizer task details not found")

            style_prompts = {
                WritingStyle.NATURAL: "Rewrite this as if it were written by a real person having a natural conversation with a friend.",
                WritingStyle.ACADEMIC: "Rewrite this in a formal academic tone, but make it sound like it was written by a real graduate student, not AI.",
                WritingStyle.CASUAL: "Rewrite this casually, like a personal blog post or a relaxed conversation over coffee.",
                WritingStyle.PROFESSIONAL: "Rewrite with a business-professional tone, like an experienced manager wrote it.",
                WritingStyle.CREATIVE: "Rewrite this in a fresh and imaginative way, like a creative human with a distinct personality wrote it."
            }

            style_instruction = style_prompts.get(
                humanizer_task.writing_style,
                style_prompts[WritingStyle.NATURAL]
            )

            prompt = f"""
    You are a skilled ghostwriter, not an AI. Your job is to rewrite text so that it feels *entirely human-written*.

    Hard Rules:
    - {style_instruction}
    - Avoid robotic or AI-style structure and phrasing
    - Use natural language patterns, idiomatic expressions, and subtle human quirks
    - Break perfect grammar and flow *slightly* where appropriate (e.g., sentence fragments, casual tone)
    - Vary sentence lengths and structures: mix short, punchy lines with longer ones
    - Use contractions and relaxed phrasing when tone allows
    - DO NOT add explanations or "rewritten" labels. Output ONLY the rewritten text.
    - Never copy large phrases verbatim. Rewrite in a way that AI detectors will see as fully human-authored.

    """

            if humanizer_task.target_tone:
                prompt += f"\nTone: Maintain a {humanizer_task.target_tone} tone throughout."

            if humanizer_task.preserve_formatting:
                prompt += "\nPreserve all original formatting and paragraph structure."

            prompt += f"\n\nOriginal text:\n{task.input_text}"

            logger.info(f"Making enhanced API call to Azure OpenAI for task {task.id}")
            logger.debug(f"Deployment: {self.deployment_name}")

            try:
                response = self.client.chat.completions.create(
                    model=self.deployment_name,
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You are a professional human editor. You rewrite content so well "
                                "that it passes all AI detection tools by sounding 100% human. "
                                "You're not an AI. You write like a nuanced, real person."
                            )
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    temperature=0.95,
                    max_tokens=4000,
                    top_p=0.95,
                    frequency_penalty=0.5,
                    presence_penalty=0.4
                )
            except Exception as e:
                logger.error(f"Azure OpenAI API call failed for task {task.id}: {str(e)}")
                raise

            humanized_text = response.choices[0].message.content.strip()

            logger.info(f"Successfully produced human-like text for task {task.id}")

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

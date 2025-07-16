"""
Security utilities for the blog application
"""
import re
import html
from urllib.parse import urlparse
from django.utils.html import strip_tags
from django.core.exceptions import ValidationError
from django.core.validators import URLValidator


class SecurityUtils:
    """Security utilities for content validation and sanitization"""
    
    # Allowed HTML tags for blog content
    ALLOWED_TAGS = [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'div', 'span',
        'strong', 'b', 'em', 'i', 'u', 's', 'mark',
        'ul', 'ol', 'li',
        'blockquote', 'pre', 'code',
        'a', 'img',
        'hr'
    ]
    
    # Suspicious patterns that might indicate malicious content
    SUSPICIOUS_PATTERNS = [
        r'<script[\s\S]*?</script>',
        r'javascript:',
        r'vbscript:',
        r'onload\s*=',
        r'onerror\s*=',
        r'onclick\s*=',
        r'onmouseover\s*=',
        r'expression\s*\(',
        r'eval\s*\(',
        r'document\.cookie',
        r'document\.write',
        r'window\.location',
        r'<iframe',
        r'<object',
        r'<embed',
        r'<form',
    ]
    
    @classmethod
    def sanitize_html_content(cls, content):
        """
        Sanitize HTML content for blog posts
        """
        if not content:
            return ''
        
        # Convert to string if not already
        content = str(content)
        
        # Check for suspicious patterns
        for pattern in cls.SUSPICIOUS_PATTERNS:
            if re.search(pattern, content, re.IGNORECASE):
                raise ValidationError(f"Suspicious content detected: {pattern}")
        
        # Basic HTML escaping for security
        # Note: In production, use a proper HTML sanitizer like bleach
        content = html.escape(content, quote=False)
        
        # Allow specific safe HTML tags back
        safe_replacements = {
            '&lt;p&gt;': '<p>',
            '&lt;/p&gt;': '</p>',
            '&lt;br&gt;': '<br>',
            '&lt;strong&gt;': '<strong>',
            '&lt;/strong&gt;': '</strong>',
            '&lt;em&gt;': '<em>',
            '&lt;/em&gt;': '</em>',
            '&lt;h1&gt;': '<h1>',
            '&lt;/h1&gt;': '</h1>',
            '&lt;h2&gt;': '<h2>',
            '&lt;/h2&gt;': '</h2>',
            '&lt;h3&gt;': '<h3>',
            '&lt;/h3&gt;': '</h3>',
            '&lt;ul&gt;': '<ul>',
            '&lt;/ul&gt;': '</ul>',
            '&lt;ol&gt;': '<ol>',
            '&lt;/ol&gt;': '</ol>',
            '&lt;li&gt;': '<li>',
            '&lt;/li&gt;': '</li>',
            '&lt;code&gt;': '<code>',
            '&lt;/code&gt;': '</code>',
            '&lt;pre&gt;': '<pre>',
            '&lt;/pre&gt;': '</pre>',
            '&lt;blockquote&gt;': '<blockquote>',
            '&lt;/blockquote&gt;': '</blockquote>',
        }
        
        for escaped, safe in safe_replacements.items():
            content = content.replace(escaped, safe)
        
        return content
    
    @classmethod
    def validate_image_url(cls, url):
        """
        Validate image URLs for security
        """
        if not url:
            return False
        
        try:
            validator = URLValidator()
            validator(url)
            
            parsed = urlparse(url)
            
            # Only allow HTTP/HTTPS
            if parsed.scheme not in ['http', 'https']:
                return False
            
            # Check for valid image extensions
            valid_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
            path_lower = parsed.path.lower()
            
            return (
                any(path_lower.endswith(ext) for ext in valid_extensions) or
                '/upload/' in parsed.path or
                '/media/' in parsed.path or
                '/static/' in parsed.path
            )
            
        except ValidationError:
            return False
    
    @classmethod
    def sanitize_text_input(cls, text, max_length=1000):
        """
        Sanitize plain text input
        """
        if not text:
            return ''
        
        # Convert to string and strip HTML tags
        text = strip_tags(str(text))
        
        # Remove excessive whitespace
        text = ' '.join(text.split())
        
        # Limit length
        if len(text) > max_length:
            text = text[:max_length]
        
        return text.strip()
    
    @classmethod
    def validate_file_upload(cls, uploaded_file):
        """
        Validate uploaded files for security
        """
        if not uploaded_file:
            raise ValidationError("No file provided")
        
        # Check file size (10MB limit)
        max_size = 10 * 1024 * 1024
        if uploaded_file.size > max_size:
            raise ValidationError("File too large. Maximum size is 10MB.")
        
        # Check file type
        allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        if uploaded_file.content_type not in allowed_types:
            raise ValidationError("Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.")
        
        # Check file extension
        name_lower = uploaded_file.name.lower()
        valid_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
        
        if not any(name_lower.endswith(ext) for ext in valid_extensions):
            raise ValidationError("Invalid file extension.")
        
        # Check for suspicious file names
        suspicious_patterns = ['.php', '.js', '.html', '.htm', '.exe', '.bat', '.py']
        if any(pattern in name_lower for pattern in suspicious_patterns):
            raise ValidationError("Suspicious file name detected.")
        
        return True


class RateLimiter:
    """Simple in-memory rate limiter"""
    
    def __init__(self):
        self.requests = {}
    
    def is_allowed(self, identifier, max_requests=10, window_seconds=60):
        """
        Check if request is allowed based on rate limiting
        """
        import time
        
        now = time.time()
        window_start = now - window_seconds
        
        if identifier not in self.requests:
            self.requests[identifier] = []
        
        # Remove old requests
        self.requests[identifier] = [
            req_time for req_time in self.requests[identifier] 
            if req_time > window_start
        ]
        
        if len(self.requests[identifier]) >= max_requests:
            return False
        
        self.requests[identifier].append(now)
        return True


# Global rate limiter instance
rate_limiter = RateLimiter()

// Blog Content JavaScript Enhancements
// This file handles image loading, error handling, and other dynamic features

// Image loading enhancement
export const enhanceBlogContent = (contentElement) => {
  if (!contentElement) return;

  // Handle images
  const images = contentElement.querySelectorAll('img');
  
  images.forEach(img => {
    // Add loading placeholder
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.3s ease';
    
    // Create loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'image-loading-placeholder';
    loadingDiv.style.cssText = `
      width: 100%;
      height: 200px;
      background: linear-gradient(45deg, #f3f4f6 25%, transparent 25%), 
                  linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), 
                  linear-gradient(45deg, transparent 75%, #f3f4f6 75%), 
                  linear-gradient(-45deg, transparent 75%, #f3f4f6 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
      animation: loading 1s linear infinite;
      border-radius: 0.75rem;
      border: 1px solid #e5e7eb;
      margin: 2.5rem auto;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6b7280;
      font-size: 0.875rem;
    `;
    loadingDiv.textContent = 'Loading image...';
    
    // Insert loading placeholder before image
    img.parentNode.insertBefore(loadingDiv, img);
    
    // Handle successful load
    img.onload = () => {
      img.style.opacity = '1';
      if (loadingDiv.parentNode) {
        loadingDiv.remove();
      }
    };
    
    // Handle error
    img.onerror = () => {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'image-error-placeholder';
      errorDiv.style.cssText = `
        width: 100%;
        height: 200px;
        background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
        border: 2px dashed #fca5a5;
        border-radius: 0.75rem;
        margin: 2.5rem auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #dc2626;
        font-size: 0.875rem;
        text-align: center;
        padding: 1rem;
      `;
      
      const icon = document.createElement('div');
      icon.innerHTML = `
        <svg class="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      `;
      
      const text = document.createElement('div');
      text.textContent = 'Failed to load image';
      
      const retry = document.createElement('button');
      retry.textContent = 'Retry';
      retry.style.cssText = `
        margin-top: 0.5rem;
        padding: 0.25rem 0.75rem;
        background-color: #dc2626;
        color: white;
        border: none;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        cursor: pointer;
      `;
      
      retry.onclick = () => {
        // Retry loading the image
        const newImg = img.cloneNode(true);
        errorDiv.parentNode.replaceChild(newImg, errorDiv);
        // Re-enhance the new image
        enhanceImage(newImg);
      };
      
      errorDiv.appendChild(icon);
      errorDiv.appendChild(text);
      errorDiv.appendChild(retry);
      
      if (loadingDiv.parentNode) {
        loadingDiv.remove();
      }
      img.parentNode.replaceChild(errorDiv, img);
    };
    
    // If image is already loaded
    if (img.complete) {
      img.onload();
    }
  });
  
  // Handle code blocks
  const codeBlocks = contentElement.querySelectorAll('pre');
  codeBlocks.forEach(pre => {
    // Add copy button to code blocks
    const copyButton = document.createElement('button');
    copyButton.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    `;
    copyButton.style.cssText = `
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      background: rgba(255, 255, 255, 0.1);
      color: #f1f5f9;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 0.375rem;
      padding: 0.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
      backdrop-filter: blur(4px);
      z-index: 10;
    `;
    
    copyButton.onmouseover = () => {
      copyButton.style.background = 'rgba(255, 255, 255, 0.2)';
    };
    
    copyButton.onmouseout = () => {
      copyButton.style.background = 'rgba(255, 255, 255, 0.1)';
    };
    
    copyButton.onclick = async () => {
      const code = pre.querySelector('code');
      if (code) {
        try {
          await navigator.clipboard.writeText(code.textContent);
          copyButton.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          `;
          setTimeout(() => {
            copyButton.innerHTML = `
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            `;
          }, 2000);
        } catch (err) {
          console.error('Failed to copy code:', err);
        }
      }
    };
    
    pre.style.position = 'relative';
    pre.appendChild(copyButton);
  });
  
  // Handle external links
  const links = contentElement.querySelectorAll('a[href^="http"]');
  links.forEach(link => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer nofollow';
    
    // Add external link icon
    const icon = document.createElement('span');
    icon.innerHTML = `
      <svg class="w-3 h-3 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    `;
    link.appendChild(icon);
  });
};

// Helper function to enhance individual images
const enhanceImage = (img) => {
  // Implementation for individual image enhancement
  // This is used when retrying failed images
};

// Add loading animation CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes loading {
    0% { background-position: 0 0, 0 10px, 10px -10px, -10px 0px; }
    100% { background-position: 20px 20px, 20px 30px, 30px 10px, 10px 20px; }
  }
`;
document.head.appendChild(style);

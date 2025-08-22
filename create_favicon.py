#!/usr/bin/env python3
"""
Create favicon PNG files for Editaliza platform
Creates multiple sizes: 16x16, 32x32, 48x48
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_favicon_with_e(size, filename):
    """Create favicon with just the 'E' letter"""
    
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Use brand blue background
    brand_blue = (5, 40, 242)  # #0528f2
    
    # Draw background circle or rounded rectangle
    padding = 2
    draw.rounded_rectangle(
        [padding, padding, size-padding, size-padding], 
        radius=size//8, 
        fill=brand_blue
    )
    
    # Try to load a font, fallback to default if not available
    try:
        # Try different common font paths
        font_paths = [
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/calibri.ttf", 
            "arial.ttf",
            "/System/Library/Fonts/Arial.ttf",  # macOS
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"  # Linux
        ]
        
        font = None
        font_size = int(size * 0.6)  # 60% of favicon size
        
        for font_path in font_paths:
            try:
                if os.path.exists(font_path):
                    font = ImageFont.truetype(font_path, font_size)
                    break
            except:
                continue
                
        if font is None:
            font = ImageFont.load_default()
            
    except Exception:
        font = ImageFont.load_default()
    
    # Draw white 'E' in the center
    text = "E"
    
    # Get text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Center the text
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - 1  # Slight adjustment for better centering
    
    # Draw the text in white
    draw.text((x, y), text, fill='white', font=font)
    
    # Save the image
    img.save(filename, 'PNG', optimize=True)
    print(f"Created {filename} ({size}x{size})")

def create_favicon_with_logo(size, filename):
    """Create favicon with simplified logo icon (the diamond/shield shape)"""
    
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Colors from the original logo
    brand_blue = (5, 40, 242)  # #0528f2
    brand_green = (26, 217, 55)  # #1ad937
    
    # Draw simplified version of the logo icon
    center = size // 2
    
    if size >= 32:
        # For larger sizes, draw a simplified version of the diamond/shield
        # Main diamond shape
        diamond_size = size * 0.8
        points = [
            (center, size * 0.1),  # top
            (size * 0.9, center),  # right  
            (center, size * 0.9),  # bottom
            (size * 0.1, center)   # left
        ]
        draw.polygon(points, fill=brand_blue)
        
        # Add small accent elements
        inner_size = size * 0.3
        inner_points = [
            (center, center - inner_size//2),
            (center + inner_size//2, center),
            (center, center + inner_size//2),
            (center - inner_size//2, center)
        ]
        draw.polygon(inner_points, fill='white')
        
        # Add small green accents
        accent_size = size * 0.1
        draw.ellipse([center - accent_size//2, center - accent_size//2, 
                     center + accent_size//2, center + accent_size//2], 
                    fill=brand_green)
        
    else:
        # For 16x16, just use a simple design
        # Draw background circle
        padding = 1
        draw.ellipse([padding, padding, size-padding, size-padding], 
                    fill=brand_blue)
        
        # Draw 'E' in white
        try:
            font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", size-6)
        except:
            font = ImageFont.load_default()
            
        text = "E"
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        x = (size - text_width) // 2
        y = (size - text_height) // 2 - 1
        
        draw.text((x, y), text, fill='white', font=font)
    
    # Save the image
    img.save(filename, 'PNG', optimize=True)
    print(f"Created {filename} ({size}x{size})")

def main():
    """Create all favicon sizes"""
    
    # Make sure we're in the right directory
    public_dir = r"C:\Users\Gabriel\OneDrive\Área de Trabalho\Editaliza\public"
    
    # Create favicons with 'E' letter design
    create_favicon_with_e(16, os.path.join(public_dir, "favicon-16x16.png"))
    create_favicon_with_e(32, os.path.join(public_dir, "favicon-32x32.png"))
    create_favicon_with_e(48, os.path.join(public_dir, "favicon-48x48.png"))
    
    # Create the main favicon.png (32x32 is standard)
    create_favicon_with_e(32, os.path.join(public_dir, "favicon.png"))
    
    # Also create icon-only versions for comparison
    create_favicon_with_logo(16, os.path.join(public_dir, "favicon-icon-16x16.png"))
    create_favicon_with_logo(32, os.path.join(public_dir, "favicon-icon-32x32.png"))
    create_favicon_with_logo(48, os.path.join(public_dir, "favicon-icon-48x48.png"))
    
    print("\nFavicon files created successfully!")
    print("Main favicon: favicon.png (32x32)")
    print("Additional sizes: favicon-16x16.png, favicon-32x32.png, favicon-48x48.png")
    print("Icon versions: favicon-icon-16x16.png, favicon-icon-32x32.png, favicon-icon-48x48.png")

if __name__ == "__main__":
    main()
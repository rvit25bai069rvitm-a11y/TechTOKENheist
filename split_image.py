from PIL import Image
import os

# Load the image
image_path = "assets/ChatGPT Image May 16, 2026, 09_40_46 PM.png"  # Update this path if needed
img = Image.open(image_path)

# Get image dimensions
width, height = img.size
print(f"Original image size: {width}x{height}")

# Calculate crop dimensions for 2 rows x 3 columns
crop_width = width // 3
crop_height = height // 2

# Character names in order (top-left to bottom-right)
names = [
    "alicia_sierra",
    "berlin",
    "manila",
    "darth_nova",
    "seo_yeon",
    "kael_ren"
]

# Create output directory if it doesn't exist
output_dir = "split_images"
os.makedirs(output_dir, exist_ok=True)

# Split and save images
index = 0
for row in range(2):
    for col in range(3):
        # Calculate crop box (left, upper, right, lower)
        left = col * crop_width
        upper = row * crop_height
        right = left + crop_width
        lower = upper + crop_height
        
        # Crop the image
        cropped = img.crop((left, upper, right, lower))
        
        # Save with character name
        output_path = os.path.join(output_dir, f"{names[index]}.png")
        cropped.save(output_path)
        print(f"Saved: {output_path} ({crop_width}x{crop_height})")
        
        index += 1

print(f"\nAll {index} images saved to '{output_dir}/' directory")

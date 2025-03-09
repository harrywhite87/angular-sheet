// libs/sheet/src/lib/utils/custom-ui.utils.ts

import { CellRenderContext } from '../models/sheet.model';

// -------------------------------------
// Types and Interfaces
// -------------------------------------

export interface ButtonConfig {
    label?: string;
    backgroundColor?: string;
    hoverColor?: string;
    activeColor?: string;
    textColor?: string;
    borderRadius?: number;
    fontSize?: string;
    fontFamily?: string;
    onClick?: () => void;
}

interface ButtonState {
    isHovered: boolean;
    isPressed: boolean;
}

// -------------------------------------
// Internal State Tracking
// -------------------------------------

const buttonStates = new Map<string, ButtonState>();

function getButtonState(cellId: string): ButtonState {
    if (!buttonStates.has(cellId)) {
        buttonStates.set(cellId, { isHovered: false, isPressed: false });
    }
    // The non-null assertion here (!) is safe because we just set it if missing.
    return buttonStates.get(cellId)!;
}

function updateButtonState(cellId: string, state: Partial<ButtonState>): void {
    const currentState = getButtonState(cellId);
    buttonStates.set(cellId, { ...currentState, ...state });
}

// -------------------------------------
// Text Helpers
// -------------------------------------

function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const testLine = `${currentLine} ${word}`;
        const lineWidth = ctx.measureText(testLine).width;

        if (lineWidth < maxWidth) {
            currentLine = testLine;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }

    if (currentLine) {
        lines.push(currentLine);
    }
    return lines;
}

function renderText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    lineHeight: number
): void {
    const padding = 4;
    const lines = wrapText(ctx, text, width - padding * 2);
    const totalTextHeight = lines.length * lineHeight;

    // Center vertically
    let currentY = y + (height - totalTextHeight) / 2 + lineHeight / 2;

    for (const line of lines) {
        const textWidth = ctx.measureText(line).width;
        ctx.fillText(line, x, y);
        currentY += lineHeight;
    }
}

// -------------------------------------
// Shadow Helper
// -------------------------------------
function applyButtonShadow(
    ctx: CanvasRenderingContext2D,
    hovered: boolean
): void {
    if (hovered) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 3;
    } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
    }
}

// -------------------------------------
// Main Renderer Factory
// -------------------------------------

export function createButtonRenderer(config: ButtonConfig) {
    return (context: CellRenderContext) => {
        const {
            ctx,
            x,
            y,
            width,
            height,
            value,
            hoverPoint,
            isFocused,
            isSelected
        } = context;

        const {
            label = value?.toString() ?? 'Button',
            backgroundColor = 'rgb(0, 95, 184)',
            hoverColor = 'rgb(2, 88, 168)',
            activeColor = 'rgba(41, 89, 170, 0.57)',
            textColor = '#ffffff',
            borderRadius = 3,
            fontSize = '9.35px',
            fontFamily = 'Arial',
            onClick
        } = config;

        // Padding around the main button area
        const padding = 4;
        const buttonArea = {
            x: x + padding,
            y: y + padding,
            width: width - padding * 2,
            height: height - padding * 2
        };

        // Generate unique cell ID (better if you ensure no collisions at your grid level)
        const cellId = `button_${x}_${y}`;

        // Local 'isHovered' check (freshly computed)
        const pointerIsInside =
            hoverPoint &&
            hoverPoint.x >= 0 &&
            hoverPoint.x <= width &&
            hoverPoint.y >= 0 &&
            hoverPoint.y <= height;

        if (pointerIsInside) {
            updateButtonState(cellId, { isHovered: true });
        } else {
            updateButtonState(cellId, { isHovered: false });
        }

        const buttonState = getButtonState(cellId);

        // Determine fill color
        let fillColor = backgroundColor;
        if (buttonState.isPressed) {
            fillColor = activeColor;
        } else if (buttonState.isHovered) {
            fillColor = hoverColor;
        }

        // Clear the cell area first
        ctx.clearRect(x, y, width, height);

        // Save so we can restore after shadow
        ctx.save();
        applyButtonShadow(ctx, buttonState.isHovered);

        // Begin path for rounded rectangle
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(
                buttonArea.x,
                buttonArea.y,
                buttonArea.width,
                buttonArea.height,
                borderRadius
            );
        } else {
            // Fallback for older browsers
            const rx = borderRadius;
            const ry = borderRadius;
            ctx.moveTo(buttonArea.x + rx, buttonArea.y);
            ctx.lineTo(buttonArea.x + buttonArea.width - rx, buttonArea.y);
            ctx.quadraticCurveTo(
                buttonArea.x + buttonArea.width,
                buttonArea.y,
                buttonArea.x + buttonArea.width,
                buttonArea.y + ry
            );
            ctx.lineTo(buttonArea.x + buttonArea.width, buttonArea.y + buttonArea.height - ry);
            ctx.quadraticCurveTo(
                buttonArea.x + buttonArea.width,
                buttonArea.y + buttonArea.height,
                buttonArea.x + buttonArea.width - rx,
                buttonArea.y + buttonArea.height
            );
            ctx.lineTo(buttonArea.x + rx, buttonArea.y + buttonArea.height);
            ctx.quadraticCurveTo(
                buttonArea.x,
                buttonArea.y + buttonArea.height,
                buttonArea.x,
                buttonArea.y + buttonArea.height - ry
            );
            ctx.lineTo(buttonArea.x, buttonArea.y + ry);
            ctx.quadraticCurveTo(
                buttonArea.x,
                buttonArea.y,
                buttonArea.x + rx,
                buttonArea.y
            );
            ctx.closePath();
        }

        // Fill the button rectangle
        ctx.fillStyle = fillColor;
        ctx.fill();

        // Restore context so subsequent calls won't have the shadow
        ctx.restore();

        // Render the text
        ctx.fillStyle = textColor;
        ctx.font = `${fontSize} ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const fontSizeNumber = parseInt(fontSize, 10) || 14;
        const lineHeight = fontSizeNumber * 1.2;
        renderText(
            ctx,
            label,
            buttonArea.x + buttonArea.width / 2,
            buttonArea.y + buttonArea.height / 2,
            buttonArea.width,
            buttonArea.height,
            lineHeight
        );

        // If the cell is focused or selected, add a small outline or highlight
        if (isFocused || isSelected) {
            ctx.save();
            ctx.strokeStyle = '#2196F3';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }

        // Return the hit area info so the calling code can handle clicks
        return {
            cellId,
            hitArea: buttonArea,
            onClick
        };
    };
}

// -------------------------------------
// Image Renderer Configuration
// -------------------------------------

export interface ImageConfig {
    // Source of the image - can be a URL or base64 encoded data
    src: string;
    // How to fit the image (cover, contain, fill, none)
    objectFit?: 'cover' | 'contain' | 'fill' | 'none';
    // Horizontal position (left, center, right)
    alignX?: 'left' | 'center' | 'right';
    // Vertical position (top, middle, bottom)
    alignY?: 'top' | 'middle' | 'bottom';
    // Border radius for the image (px)
    borderRadius?: number;
    // Border for the image
    border?: string;
    // Background color for the cell
    backgroundColor?: string;
    // Padding around the image (px)
    padding?: number;
    // Optional alt text (for accessibility/tooltips)
    alt?: string;
    // Optional callback when image is clicked
    onClick?: () => void;
}

// Cache for loaded images to improve performance
const imageCache = new Map<string, HTMLImageElement>();

/**
 * Creates a renderer function that displays an image inside a cell
 * 
 * @param config Configuration for the image
 * @returns CellRenderer function
 */
export function createImageRenderer(config: ImageConfig) {
    return (context: CellRenderContext) => {
        const {
            ctx,
            x,
            y,
            width,
            height,
            hoverPoint,
            isFocused,
            isSelected
        } = context;

        const {
            src,
            objectFit = 'contain',
            alignX = 'center',
            alignY = 'middle',
            borderRadius = 0,
            border = '',
            backgroundColor = 'white',
            padding = 4,
            alt = '',
            onClick
        } = config;

        // Clean the cell background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(x, y, width, height);

        // Generate a unique ID for the cell-image combination
        const cellId = `image_${x}_${y}`;

        // Calculate the actual drawable area considering padding
        const drawArea = {
            x: x + padding,
            y: y + padding,
            width: Math.max(0, width - padding * 2),
            height: Math.max(0, height - padding * 2)
        };

        // Check if mouse is over the image (for hover effects if needed)
        const pointerIsInside =
            hoverPoint &&
            hoverPoint.x >= 0 &&
            hoverPoint.x <= width &&
            hoverPoint.y >= 0 &&
            hoverPoint.y <= height;

        // If there's a border, draw it
        if (border) {
            ctx.save();
            ctx.strokeStyle = border;
            ctx.lineWidth = 1;

            // Draw the border with border radius if specified
            if (borderRadius > 0) {
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(
                        drawArea.x,
                        drawArea.y,
                        drawArea.width,
                        drawArea.height,
                        borderRadius
                    );
                } else {
                    // Fallback for browsers without roundRect
                    const rx = borderRadius;
                    const ry = borderRadius;
                    ctx.moveTo(drawArea.x + rx, drawArea.y);
                    ctx.lineTo(drawArea.x + drawArea.width - rx, drawArea.y);
                    ctx.quadraticCurveTo(
                        drawArea.x + drawArea.width,
                        drawArea.y,
                        drawArea.x + drawArea.width,
                        drawArea.y + ry
                    );
                    ctx.lineTo(drawArea.x + drawArea.width, drawArea.y + drawArea.height - ry);
                    ctx.quadraticCurveTo(
                        drawArea.x + drawArea.width,
                        drawArea.y + drawArea.height,
                        drawArea.x + drawArea.width - rx,
                        drawArea.y + drawArea.height
                    );
                    ctx.lineTo(drawArea.x + rx, drawArea.y + drawArea.height);
                    ctx.quadraticCurveTo(
                        drawArea.x,
                        drawArea.y + drawArea.height,
                        drawArea.x,
                        drawArea.y + drawArea.height - ry
                    );
                    ctx.lineTo(drawArea.x, drawArea.y + ry);
                    ctx.quadraticCurveTo(
                        drawArea.x,
                        drawArea.y,
                        drawArea.x + rx,
                        drawArea.y
                    );
                    ctx.closePath();
                }
                ctx.stroke();

                // Create a clipping region for the image
                ctx.clip();
            } else {
                // Simple rectangle border if no radius
                ctx.strokeRect(drawArea.x, drawArea.y, drawArea.width, drawArea.height);
            }
            ctx.restore();
        }

        // Setup for drawing the image
        let img: HTMLImageElement;

        // Try to get from cache first
        if (imageCache.has(src)) {
            img = imageCache.get(src)!;
            drawImageInCell(ctx, img, drawArea, objectFit, alignX, alignY, borderRadius);
        } else {
            // Load the image if not in cache
            img = new Image();
            img.onload = () => {
                // Add to cache once loaded
                imageCache.set(src, img);
                // Draw the image
                drawImageInCell(ctx, img, drawArea, objectFit, alignX, alignY, borderRadius);
            };
            img.onerror = () => {
                // Draw a placeholder or error indicator
                ctx.save();
                ctx.fillStyle = '#f8d7da';
                ctx.fillRect(drawArea.x, drawArea.y, drawArea.width, drawArea.height);
                ctx.fillStyle = '#721c24';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('Image Error', drawArea.x + drawArea.width / 2, drawArea.y + drawArea.height / 2);
                ctx.restore();
            };
            img.src = src;
        }

        // If the cell is focused or selected, add a highlight
        if (isFocused || isSelected) {
            ctx.save();
            ctx.strokeStyle = '#2196F3';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
            ctx.restore();
        }

        // Return hit area info for click handling
        return {
            cellId,
            hitArea: drawArea,
            onClick
        };
    };
}

/**
 * Helper function to draw the image with proper sizing and alignment
 */
function drawImageInCell(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    drawArea: { x: number; y: number; width: number; height: number },
    objectFit: 'cover' | 'contain' | 'fill' | 'none',
    alignX: 'left' | 'center' | 'right',
    alignY: 'top' | 'middle' | 'bottom',
    borderRadius: number
) {
    // Save context state
    ctx.save();

    // Apply clipping if border radius is specified
    if (borderRadius > 0) {
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(
                drawArea.x,
                drawArea.y,
                drawArea.width,
                drawArea.height,
                borderRadius
            );
        } else {
            // Fallback for browsers without roundRect
            const rx = borderRadius;
            const ry = borderRadius;
            ctx.moveTo(drawArea.x + rx, drawArea.y);
            ctx.lineTo(drawArea.x + drawArea.width - rx, drawArea.y);
            ctx.quadraticCurveTo(
                drawArea.x + drawArea.width,
                drawArea.y,
                drawArea.x + drawArea.width,
                drawArea.y + ry
            );
            ctx.lineTo(drawArea.x + drawArea.width, drawArea.y + drawArea.height - ry);
            ctx.quadraticCurveTo(
                drawArea.x + drawArea.width,
                drawArea.y + drawArea.height,
                drawArea.x + drawArea.width - rx,
                drawArea.y + drawArea.height
            );
            ctx.lineTo(drawArea.x + rx, drawArea.y + drawArea.height);
            ctx.quadraticCurveTo(
                drawArea.x,
                drawArea.y + drawArea.height,
                drawArea.x,
                drawArea.y + drawArea.height - ry
            );
            ctx.lineTo(drawArea.x, drawArea.y + ry);
            ctx.quadraticCurveTo(
                drawArea.x,
                drawArea.y,
                drawArea.x + rx,
                drawArea.y
            );
            ctx.closePath();
        }
        ctx.clip();
    }

    // Calculate dimensions based on objectFit
    let sWidth = img.width;
    let sHeight = img.height;
    let dx = drawArea.x;
    let dy = drawArea.y;
    let dWidth = drawArea.width;
    let dHeight = drawArea.height;

    if (objectFit === 'contain') {
        // Scale to fit while maintaining aspect ratio
        const scale = Math.min(
            drawArea.width / img.width,
            drawArea.height / img.height
        );
        dWidth = img.width * scale;
        dHeight = img.height * scale;

        // Adjust position based on alignment
        if (alignX === 'center') {
            dx = drawArea.x + (drawArea.width - dWidth) / 2;
        } else if (alignX === 'right') {
            dx = drawArea.x + drawArea.width - dWidth;
        }

        if (alignY === 'middle') {
            dy = drawArea.y + (drawArea.height - dHeight) / 2;
        } else if (alignY === 'bottom') {
            dy = drawArea.y + drawArea.height - dHeight;
        }
    } else if (objectFit === 'cover') {
        // Cover the area while maintaining aspect ratio (may crop)
        const scale = Math.max(
            drawArea.width / img.width,
            drawArea.height / img.height
        );
        dWidth = img.width * scale;
        dHeight = img.height * scale;

        // Center the image and adjust for overflow
        dx = drawArea.x + (drawArea.width - dWidth) / 2;
        dy = drawArea.y + (drawArea.height - dHeight) / 2;
    } else if (objectFit === 'none') {
        // Use original size and position according to alignment
        dWidth = img.width;
        dHeight = img.height;

        if (alignX === 'center') {
            dx = drawArea.x + (drawArea.width - dWidth) / 2;
        } else if (alignX === 'right') {
            dx = drawArea.x + drawArea.width - dWidth;
        }

        if (alignY === 'middle') {
            dy = drawArea.y + (drawArea.height - dHeight) / 2;
        } else if (alignY === 'bottom') {
            dy = drawArea.y + drawArea.height - dHeight;
        }
    }
    // 'fill' uses the default values which stretch the image

    // Draw the image
    ctx.drawImage(img, dx, dy, dWidth, dHeight);

    // Restore context state
    ctx.restore();
}
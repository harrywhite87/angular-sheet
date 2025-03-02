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

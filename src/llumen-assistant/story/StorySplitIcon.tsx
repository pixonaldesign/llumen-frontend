import type { IconProps } from '@phosphor-icons/react'

const STROKE_BY_WEIGHT = { thin: 8, light: 12, regular: 16, bold: 24, fill: 16, duotone: 16 }

/** Horizontal split: two panels divided by a full-width rule. Drawn on Phosphor's 256 grid. */
export function SplitIcon({ size = 16, weight = 'regular', color = 'currentColor', ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      stroke={color}
      strokeWidth={STROKE_BY_WEIGHT[weight]}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d="M48 96V56h160v40" />
      <path d="M32 128h192" />
      <path d="M48 160v40h160v-40" />
    </svg>
  )
}

import { HeaderOptionSwitcher } from './HeaderOptionSwitcher'
import { CHAT_INTERACTION_MODELS, type ChatInteractionModel } from './interactionModel'

export type InteractionModelSwitcherProps = {
  value: ChatInteractionModel
  onChange: (next: ChatInteractionModel) => void
}

export function InteractionModelSwitcher({ value, onChange }: InteractionModelSwitcherProps) {
  return (
    <HeaderOptionSwitcher
      kicker="UX"
      label="Chat interaction model"
      options={CHAT_INTERACTION_MODELS}
      value={value}
      onChange={onChange}
    />
  )
}

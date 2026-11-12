import { FlowArrow } from '@phosphor-icons/react'
import { ApiRequestConfig, ChatMessageConfig, EmailConfig } from './ActionConfig'
import { AgentInstructionsConfig, AiFindingsConfig, AppConfig, ClassificationConfig, GisConfig, InsightConfig } from './AgentConfig'
import { Card } from './ConfigControls'
import { CreateAssetConfig } from './CreateAssetConfig'
import { AssetConfig, ForecastConfig, MlModelConfig, SourceConfig } from './DataConfig'
import { plural, type EditorContext } from './kindEditor'
import { paramsFor, type AnyParams } from './nodeKinds'
import {
  AggregateConfig,
  EditFieldsConfig,
  FilterConfig,
  IfElseConfig,
  MergeConfig,
  NoOperationConfig,
  StopAndErrorConfig,
  SwitchConfig,
  WaitConfig,
} from './TransformConfig'
import { ChatInputConfig, ManualTriggerConfig, ScheduleConfig, WebhookConfig } from './TriggerConfig'
import tones from './nodeTones.module.css'
import windowStyles from './NodeConfigWindow.module.css'

type KindConfigProps = {
  ctx: EditorContext
  onParams: (patch: Partial<AnyParams>, key: string) => void
}

/** The configuration editor for the node's kind. */
export function KindConfig({ ctx, onParams }: KindConfigProps) {
  const stored = ctx.node.config.params
  const set = onParams
  const typeId = ctx.type.id
  switch (typeId) {
    case 'manualTrigger':
      return <ManualTriggerConfig />
    case 'scheduleTrigger':
      return <ScheduleConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'chatInput':
      return <ChatInputConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'webhook':
      return <WebhookConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'asset':
      return <AssetConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'source':
      return <SourceConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'mlModel':
      return <MlModelConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'forecast':
      return <ForecastConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'createAsset': {
      const settings = paramsFor(typeId, stored)
      const source = settings.rowSource ? ctx.upstream.find((step) => step.id === settings.rowSource) : undefined
      return (
        <CreateAssetConfig
          settings={settings}
          onChange={(patch, key) => set(patch, `createAsset:${key}`)}
          records={settings.rowSource ? (source?.records ?? null) : ctx.records}
          connectedName={ctx.upstream.find((step) => step.direct)?.name ?? null}
          ancestors={ctx.upstream.map((step) => {
            const StepIcon = step.icon
            return {
              id: step.id,
              label: step.name,
              meta: step.records ? plural(step.records.length, 'item') : 'Not run',
              icon: (
                <span className={`${windowStyles.pillIcon} ${tones[`tone_${step.tone}`]}`}>
                  <StepIcon size={12} weight="fill" />
                </span>
              ),
            }
          })}
          run={ctx.run}
          onRunUpstream={ctx.onExecutePrevious}
        />
      )
    }
    case 'noOperation':
      return <NoOperationConfig />
    case 'filter':
      return <FilterConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'ifElse':
      return <IfElseConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'switchCases':
      return <SwitchConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'editFields':
      return <EditFieldsConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'aggregate':
      return <AggregateConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'merge':
      return <MergeConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'wait':
      return <WaitConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'stopAndError':
      return <StopAndErrorConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'generalAgent':
    case 'dataAnalyst':
      return <AgentInstructionsConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'createApp':
      return <AppConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'dataClassificationAgent':
      return <ClassificationConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'insightGenerator':
      return <InsightConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'gisCorrelationAgent':
      return <GisConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'aiFindings':
      return <AiFindingsConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'sendChatMessage':
      return <ChatMessageConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'sendEmail':
      return <EmailConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    case 'sendApiRequest':
      return <ApiRequestConfig params={paramsFor(typeId, stored)} set={set} ctx={ctx} />
    default:
      return <Card icon={<FlowArrow size={16} aria-hidden />} title={ctx.type.title} description={ctx.type.description} />
  }
}

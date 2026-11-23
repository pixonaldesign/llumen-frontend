import { CompactAssistantDemo } from './llumen-assistant'
import { DemoRecorderHud } from './demo-recorder/DemoRecorderHud'

function App() {
  return (
    <>
      <CompactAssistantDemo />
      {import.meta.env.DEV ? <DemoRecorderHud /> : null}
    </>
  )
}

export default App

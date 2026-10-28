import appSequential from './assets/app-sequential.jpg'
import appTabbed from './assets/app-tabbed.jpg'
import type { AppNavigation } from './nodeKinds'

/** A saved app's thumbnail, showing how its pages are reached. */
export const APP_THUMBNAIL: Record<AppNavigation, string> = { tabs: appTabbed, sequential: appSequential }

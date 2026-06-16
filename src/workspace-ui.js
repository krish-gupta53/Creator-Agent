import { WORKSPACE_STYLE } from './workspace-ui-style.js';
import { WORKSPACE_MARKUP } from './workspace-ui-markup.js';
import { WORKSPACE_SCRIPT_A, WORKSPACE_SCRIPT_B } from './workspace-ui-script.js';

export const WORKSPACE_UI = `${WORKSPACE_STYLE}${WORKSPACE_MARKUP}<script>${WORKSPACE_SCRIPT_A}${WORKSPACE_SCRIPT_B}</script>`;

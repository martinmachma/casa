import { useEffect, useRef } from 'react'
import { setDebug, useDebug } from '../debug'
import { PanelHead } from './kit'

/** A reference to the handlers in App, CameraNudger, WalkCamera and FurnitureBox. */
/** Shown while `open`; closing it (button or Escape) calls `onClose`. */
export const SettingsMenu = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const dialog = useRef<HTMLDialogElement>(null)
  const debug = useDebug()
  useEffect(() => {
    if (open) dialog.current?.showModal()
  }, [open])
  const modifier = /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? 'Cmd' : 'Ctrl'
  const sections = [
    {
      title: 'Modes & measuring',
      context: 'Inside a floor, in any interaction mode. Mode changes clear the selection and device placement.',
      rows: [
        ['E', 'View → Edit; Edit or Devices → View.'],
        ['L', 'View or Edit → Devices; Devices → Edit.'],
        ['M', 'Toggle measuring. Turning it off clears measurements; changing interaction mode keeps measuring on.'],
      ],
    },
    {
      title: 'Furniture & devices',
      context:
        'Inside a floor. Select furniture in Edit mode, or a device in Devices mode. Measuring replaces selection.',
      rows: [
        ['R / Shift+R', 'Rotate selected furniture or group by +15° / −15°.'],
        [`${modifier}+D`, 'Duplicate selected furniture or group beside the originals.'],
        ['Delete / Backspace', 'Remove selected furniture, group or device.'],
        [`${modifier}+C`, 'Copy selected furniture or group in Edit mode, with measuring off.'],
        [
          `${modifier}+V`,
          'Paste copied furniture on the current floor at the pointer’s floor position. Edit mode, measuring off; the pointer must be over the floor. Copies stay available when switching floors.',
        ],
        [
          `Shift+click / ${modifier}+click`,
          'Add furniture to the selection or remove it. Drag selected furniture to move the group.',
        ],
      ],
    },
    {
      title: 'History & cancel',
      context: 'Inside a floor, in any interaction mode.',
      rows: [
        [`${modifier}+Z`, 'Undo the last edit; clears the selection.'],
        [`${modifier}+Shift+Z / ${modifier}+Y`, 'Redo; clears the selection.'],
        [`${modifier}+S`, 'Save the changes as a new version (opens the save dialog).'],
        [
          'Escape',
          'Step back in order: clear selection, cancel device placement, clear an unfinished measurement, stop measuring (clearing measurements), then leave Devices for Edit mode. One step per press.',
        ],
      ],
    },
    {
      title: 'Camera movement',
      context: 'Hold the keys to move. Available in view and edit modes, including while measuring.',
      rows: [
        [
          'W / ↑ · S / ↓',
          'Orbit or Plan: pan forward / backward. Walk: walk forward / backward. Orbit and Plan also work in the Outside view.',
        ],
        ['A / D', 'Orbit or Plan: pan left / right. Walk: sidestep left / right.'],
        ['← / →', 'Orbit or Plan: pan left / right. Walk: turn left / right.'],
      ],
    },
    {
      title: 'Fields & dialogs',
      context:
        'While typing, fields keep their normal editing, copy/paste and undo/redo behavior; scene shortcuts pause.',
      rows: [
        ['Enter', 'Finish editing a number or room name. In Wishes & bugs, add or save the entry.'],
        ['Shift+Enter', 'New line in Wishes & bugs.'],
        [
          'Escape',
          'Cancel an existing Wishes & bugs entry’s text edit. In Settings, close this dialog and return focus to Settings.',
        ],
        ['Tab / Shift+Tab', 'Move between controls. Enter or Space opens Settings when its button is focused.'],
      ],
    },
  ]

  return (
    <>
      <dialog
        ref={dialog}
        className="settings-dialog"
        onClose={onClose}
        aria-labelledby="settings-title"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <PanelHead
          title={<span id="settings-title">Settings</span>}
          onClose={() => dialog.current?.close()}
          closeLabel="Close settings"
        />
        <div className="settings-scroll" tabIndex={0} role="region" aria-labelledby="shortcuts-title">
          <h2>Debug</h2>
          <label className="settings-toggle">
            <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />
            Name items, devices and walls under the pointer
          </label>
          <h2 id="shortcuts-title">Shortcuts</h2>
          <p className="settings-intro">
            Keyboard and selection reference. Shortcuts cannot be remapped. Scene shortcuts pause while Settings is
            open.
          </p>
          {sections.map(({ title, context, rows }) => (
            <section className="shortcut-section" key={title}>
              <h3>{title}</h3>
              <p>{context}</p>
              <dl>
                {rows.map(([keys, action]) => (
                  <div className="shortcut-row" key={keys}>
                    <dt>
                      <kbd>{keys}</kbd>
                    </dt>
                    <dd>{action}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </dialog>
    </>
  )
}

import { REDM_KEY_TO_HASH } from '../yaca'
import { requestAnimDict } from './streaming'

/**
 * Play a facial animation on a ped.
 *
 * @param ped - The ped to play the facial animation on.
 * @param animName - The animation name to use.
 * @param animDict - The animation dictionary to use.
 */
export function playRdrFacialAnim(ped: number, animName: string, animDict: string) {
  requestAnimDict(animDict, 10000).then(() => {
    SetFacialIdleAnimOverride(ped, animName, animDict)
  })
}

/**
 * Display a notification in RDR.
 *
 * @param text - The text to display.
 * @param duration - The duration to display the notification for.
 */
export const displayRdrNotification = (text: string, duration: number) => {
  // @ts-expect-error VarString is a redm native
  const str = VarString(10, 'LITERAL_STRING', text)

  const struct1 = new DataView(new ArrayBuffer(96))
  struct1.setUint32(0, duration, true)

  const struct2 = new DataView(new ArrayBuffer(8 + 8))
  struct2.setBigUint64(8, BigInt(str), true)

  Citizen.invokeNative('0x049D5C615BD38BAD', struct1, struct2, 1)
}

/**
 * Register a keybind for RDR.
 *
 * @param key - The key to bind.
 * @param onPressed - The function to call when the key is pressed.
 * @param onReleased - The function to call when the key is released.
 */
export const registerRdrKeyBind = (key: string, onPressed?: () => void, onReleased?: () => void) => {
  const keyHash = REDM_KEY_TO_HASH[key]

  if (!keyHash) {
    console.error(`[YaCA] No key hash available for ${key}, please choose another keybind`)
    return
  }

  setTick(() => {
    DisableControlAction(0, keyHash, true)
    if (onPressed && IsDisabledControlJustPressed(0, keyHash)) {
      onPressed()
    }

    if (onReleased && IsDisabledControlJustReleased(0, keyHash)) {
      onReleased()
    }
  })
}

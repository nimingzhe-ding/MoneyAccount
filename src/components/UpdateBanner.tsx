import { useApp } from '../lib/store'
import { IconClose } from './Icons'
import { AppIcon } from '../lib/appIcons'

/**
 * 首页顶部一行更新提示。
 * 打开 App 时自动检查发现新版才出现，点「下载」直接跳安装包，
 * 「×」只对这个版本闭嘴。
 */
export default function UpdateBanner() {
  const { update } = useApp()
  const { info, hasUpdate, mutedVersion } = update
  if (!info || !hasUpdate || info.latest === mutedVersion) return null

  return (
    <div className="update-banner">
      <span className="em" aria-hidden>
        <AppIcon name="party-popper" size={20} />
      </span>
      <div className="txt">
        <b>新版本 v{info.latest} 可以装了</b>
        <span>覆盖安装，账本数据保留</span>
      </div>
      <button className="btn btn-primary btn-sm" onClick={update.download}>
        下载
      </button>
      <button className="icon-btn" aria-label="这个版本不再提醒" onClick={update.mute}>
        <IconClose size={15} />
      </button>
    </div>
  )
}

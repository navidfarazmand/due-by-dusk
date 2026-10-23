import { SaveSystem } from '../systems/SaveSystem';
import { getNativeSaveStatus } from '../platform/nativeStorage';
export function initializeSaveStatus(): void {
  const status=document.createElement('div'); status.id='saveStatus'; status.setAttribute('role','status');
  status.style.cssText='position:fixed;bottom:max(8px,env(safe-area-inset-bottom));left:12px;right:70px;z-index:150;background:#fff3cd;color:#402b0a;padding:8px 12px;border-radius:8px;font:13px system-ui';
  document.body.append(status);
  let bridgeWarning='';
  function update() {
    const local=SaveSystem.getStatus(),native=getNativeSaveStatus();
    const messages=[local.state==='warning'||local.state==='recovered'?local.message:'',native?.state==='warning'?native.message:bridgeWarning].filter(Boolean);
    status.hidden=messages.length===0; status.textContent=messages.join(' ');
  }
  SaveSystem.subscribeStatus(update);
  window.addEventListener('dbd:storage-warning',event=>{bridgeWarning=(event as CustomEvent<string>).detail;update();});
  window.addEventListener('dbd:native-save-status',()=>{if(getNativeSaveStatus()?.state==='saved') bridgeWarning='';update();});
  update();
}

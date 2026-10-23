/** Landscape menu: every opening is announced so the game can pause its clock. */
export function initManagementUI() {
  const drawer = document.querySelector<HTMLElement>('#managementDrawer')!;
  const toggle = document.querySelector<HTMLButtonElement>('#btnManagement')!;
  const closeButton = document.querySelector<HTMLButtonElement>('#btnManagementClose')!;
  const scrim = document.querySelector<HTMLButtonElement>('#managementScrim')!;
  let opened = false;
  let previousFocus: HTMLElement | null = null;

  function setOpen(open: boolean) {
    if (open === opened) return;
    opened = open;
    document.documentElement.dataset.managementOpen = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    drawer.inert = !open;
    scrim.hidden = !open;
    if (open) {
      previousFocus = document.activeElement as HTMLElement;
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-modal', 'true');
      closeButton.focus();
    } else {
      drawer.removeAttribute('role');
      drawer.removeAttribute('aria-modal');
      previousFocus?.focus();
    }
    window.dispatchEvent(new CustomEvent('dbd:management', { detail: { open } }));
  }

  toggle.addEventListener('click', () => setOpen(!opened));
  closeButton.addEventListener('click', () => setOpen(false));
  scrim.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', event => {
    if (!opened || !document.querySelector<HTMLElement>('#modal')?.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
    if (event.key !== 'Tab') return;
    const items = [...drawer.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, summary, [tabindex="0"]')]
      .filter(item => item.getClientRects().length > 0);
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });

  const notice = document.querySelector<HTMLElement>('#notice')!;
  function updateBillHud() {
    const amount = notice.querySelector('.n-amt')?.textContent?.trim();
    const due = notice.querySelector('.n-due')?.textContent?.trim();
    const name = notice.querySelector('.n-name')?.textContent?.trim();
    const amountTarget = document.querySelector<HTMLElement>('#billHudAmount');
    const dueTarget = document.querySelector<HTMLElement>('#billHudDue');
    if (amount && amountTarget) amountTarget.textContent = amount;
    if (due && dueTarget) dueTarget.textContent = due.replace('Pay before you sleep.', '').replace('Due at sunset on ', 'Due ').replace('Due at sunset tomorrow, ', 'Tomorrow, ');
    document.querySelector('#billHud')?.setAttribute('aria-label', `${name || 'Next bill'}: ${amount || ''}. ${due || ''}`);
  }
  new MutationObserver(updateBillHud).observe(notice, { childList: true, subtree: true, characterData: true });
  updateBillHud();

  // Tips get their own strip above the field, never covering a growing crop.
  const messages = document.querySelector<HTMLElement>('.field-messages');
  const toast = document.querySelector<HTMLElement>('#toast');
  const eventLabel = document.querySelector<HTMLElement>('#eventLabel');
  function updateMessages() {
    if (!messages) return;
    const hasToast = !!toast?.classList.contains('show') && !!toast.textContent?.trim();
    messages.classList.toggle('has-toast', hasToast);
    messages.hidden = !hasToast && !eventLabel?.textContent?.trim();
  }
  if (messages) new MutationObserver(updateMessages).observe(messages, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  updateMessages();

  const offset = document.querySelector<HTMLInputElement>('#settingTouchOffset');
  offset?.addEventListener('input', () => {
    const output = document.querySelector<HTMLOutputElement>('#touchOffsetValue');
    if (output) output.value = `${offset.value} px`;
  });

  return { open: () => setOpen(true), close: () => setOpen(false), isOpen: () => opened };
}

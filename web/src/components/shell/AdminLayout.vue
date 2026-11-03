<script setup lang="ts">
// Khung mọi màn Admin: thanh bên + thanh kỳ lương + nội dung (RouterView ở slot).
// Chuông (BellPopover), menu tài khoản (AccountMenu), đổi mật khẩu (ChangePasswordDialog) mở từ đây;
// ?hop=chuong | menu-tai-khoan | doi-mat-khau mở sẵn (mục lục thiết kế).
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getShell } from '@/services/shell';
import { usePeriodStore } from '@/stores/period';
import { useUiStore } from '@/stores/ui';
import AccountMenu from './AccountMenu.vue';
import AdminSidebar from './AdminSidebar.vue';
import BellPopover from './BellPopover.vue';
import ChangePasswordDialog from './ChangePasswordDialog.vue';
import PeriodStrip from './PeriodStrip.vue';

const route = useRoute();
const period = usePeriodStore();
const ui = useUiStore();
ui.init();

const shell = ref({ me: {}, counts: {}, bell: 0 });
const loadShell = async () => {
  shell.value = await getShell();
};
onMounted(loadShell);
onMounted(() => period.refresh());

const bellOpen = ref(false);
const menuOpen = ref(false);
const pwOpen = ref(false);
const mobileNavOpen = ref(false);
const mobileViewport = ref(typeof window !== 'undefined' && window.innerWidth < 768);
const menuButton = ref<HTMLButtonElement | null>(null);
function closeMobileNav(restoreFocus = false) {
  if (!mobileNavOpen.value) return;
  mobileNavOpen.value = false;
  if (restoreFocus) nextTick(() => menuButton.value?.focus());
}
function onKeydown(event: KeyboardEvent) {
  if (!mobileNavOpen.value) return;
  if (event.key === 'Escape') {
    closeMobileNav(true);
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = Array.from(document.querySelectorAll<HTMLElement>('#admin-navigation a[href], #admin-navigation button:not([disabled])'));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !document.querySelector('#admin-navigation')?.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
function onResize() {
  mobileViewport.value = window.innerWidth < 768;
  if (!mobileViewport.value) closeMobileNav();
}
watch(mobileNavOpen, open => {
  if (open) nextTick(() => document.querySelector<HTMLElement>('#admin-navigation nav a, #admin-navigation nav button')?.focus());
});
onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', onResize);
});
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', onResize);
});

// Đổi màn: đóng các lớp nổi của vỏ, thanh kỳ lương về mặc định của tháng (màn mới tự đặt lại nếu cần)
watch(
  () => route.path,
  () => {
    bellOpen.value = false;
    menuOpen.value = false;
    closeMobileNav();
    period.resetStrip();
    loadShell(); // số đếm trên thanh bên và chuông theo việc vừa xử lý
  },
  { flush: 'pre' }
);
watch(
  () => route.query.thang,
  m => m && period.setMonth(String(m)),
  { immediate: true, flush: 'pre' }
);
watch(
  () => route.query.hop,
  h => {
    bellOpen.value = h === 'chuong';
    menuOpen.value = h === 'menu-tai-khoan';
    pwOpen.value = h === 'doi-mat-khau';
  },
  { immediate: true }
);
function openPassword() {
  menuOpen.value = false;
  pwOpen.value = true;
}
</script>

<template>
  <div class="app">
    <button ref="menuButton" class="mobile-nav-toggle" type="button" aria-controls="admin-navigation" :aria-expanded="mobileNavOpen" :aria-label="mobileNavOpen ? 'Đóng điều hướng' : 'Mở điều hướng'" @click="mobileNavOpen = !mobileNavOpen">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
    </button>
    <button v-if="mobileNavOpen" class="nav-scrim" type="button" aria-label="Đóng điều hướng" @click="closeMobileNav(true)" />
    <AdminSidebar
      id="admin-navigation"
      :mobile-open="mobileNavOpen"
      :mobile-inert="mobileViewport && !mobileNavOpen"
      :active="route.meta.nav as string"
      :me="shell.me"
      :counts="shell.counts"
      @open-menu="menuOpen = !menuOpen"
      @navigate="closeMobileNav()"
    />
    <main class="canvas">
      <PeriodStrip
        :bell="shell.bell"
        :show-steps="['tong-quan', 'cham-cong', 'kpi', 'luong'].includes(String(route.meta.nav || ''))"
        @open-bell="bellOpen = !bellOpen"
      />
      <slot />
    </main>
    <BellPopover v-if="bellOpen" @close="bellOpen = false" />
    <AccountMenu v-if="menuOpen" :me="shell.me" @close="menuOpen = false" @change-password="openPassword" />
    <ChangePasswordDialog v-if="pwOpen" @close="pwOpen = false" />
  </div>
</template>

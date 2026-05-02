<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <header class="top-bar">
      <RouterLink to="/" class="brand">MovieNote</RouterLink>
      <nav class="nav">
        <RouterLink to="/">홈</RouterLink>
        <RouterLink to="/write">글쓰기</RouterLink>
      </nav>
    </header>
    <main class="main">
      <RouterView />
    </main>
    <footer class="foot">
      <span>Vue · Firebase Firestore</span>
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  text-align: left;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.5rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  position: sticky;
  top: 0;
  z-index: 10;
}

.brand {
  font-weight: 700;
  font-size: 1.15rem;
  color: var(--text-h);
  text-decoration: none;
  letter-spacing: -0.02em;
}

.brand:hover {
  color: var(--accent);
}

.nav {
  display: flex;
  gap: 1.25rem;
}

.nav a {
  color: var(--text);
  text-decoration: none;
  font-size: 0.95rem;
}

.nav a.router-link-active {
  color: var(--accent);
  font-weight: 600;
}

.nav a:hover {
  color: var(--text-h);
}

.main {
  flex: 1;
}

.foot {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border);
  font-size: 0.8rem;
  color: var(--text);
  text-align: center;
}
</style>

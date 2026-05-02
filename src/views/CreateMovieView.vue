<script setup>
import { onUnmounted, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { isFirebaseConfigured } from '../firebase/config'
import { createMovieWithPoster, MAX_POSTER_FILE_BYTES } from '../services/movies'

const router = useRouter()
const title = ref('')
const introduction = ref('')
const posterFile = ref(null)
const posterPreviewUrl = ref(null)
const posterInputRef = ref(null)
const submitting = ref(false)
const error = ref(null)

function onPosterChange(e) {
  const file = e.target.files?.[0]
  posterFile.value = null
  if (posterPreviewUrl.value) {
    URL.revokeObjectURL(posterPreviewUrl.value)
    posterPreviewUrl.value = null
  }
  if (!file) return
  if (!file.type.startsWith('image/')) {
    error.value = '이미지 파일만 선택할 수 있습니다.'
    if (posterInputRef.value) posterInputRef.value.value = ''
    return
  }
  if (file.size > MAX_POSTER_FILE_BYTES) {
    error.value = `이미지는 ${MAX_POSTER_FILE_BYTES / 1024}KB 이하만 저장할 수 있습니다. (Firestore 문서 한도)`
    if (posterInputRef.value) posterInputRef.value.value = ''
    return
  }
  error.value = null
  posterFile.value = file
  posterPreviewUrl.value = URL.createObjectURL(file)
}

function clearPoster() {
  posterFile.value = null
  if (posterPreviewUrl.value) {
    URL.revokeObjectURL(posterPreviewUrl.value)
    posterPreviewUrl.value = null
  }
  if (posterInputRef.value) posterInputRef.value.value = ''
}

onUnmounted(() => {
  if (posterPreviewUrl.value) URL.revokeObjectURL(posterPreviewUrl.value)
})

async function onSubmit() {
  const t = title.value.trim()
  const intro = introduction.value.trim()
  if (!t || !intro || submitting.value) return
  if (!isFirebaseConfigured()) {
    error.value =
      'Firebase가 설정되지 않았습니다. .env 파일을 확인한 뒤 다시 시도하세요.'
    return
  }
  submitting.value = true
  error.value = null
  try {
    const docRef = await createMovieWithPoster({
      title: t,
      introduction: intro,
      posterFile: posterFile.value,
    })
    router.replace(`/movie/${docRef.id}`)
  } catch (e) {
    error.value = e.message ?? String(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="write">
    <RouterLink class="back" to="/">← 목록</RouterLink>
    <h1>영화 소개 글 쓰기</h1>
    <p class="lead">
      제목·소개와 함께 포스터 이미지를 넣을 수 있습니다. 저장 후 상세 페이지에서 댓글과 좋아요를 사용할 수 있습니다.
    </p>

    <form class="form" @submit.prevent="onSubmit">
      <div class="field">
        <label for="poster">포스터 이미지 (선택)</label>
        <input
          id="poster"
          ref="posterInputRef"
          type="file"
          accept="image/*"
          class="file-input"
          @change="onPosterChange"
        />
        <p class="hint">
          JPEG, PNG, WebP 등 · Firestore images 컬렉션에 base64로 저장 · 약
          {{ MAX_POSTER_FILE_BYTES / 1024 }}KB 이하 권장
        </p>
        <div v-if="posterPreviewUrl" class="poster-preview-wrap">
          <img :src="posterPreviewUrl" alt="" class="poster-preview" />
          <button type="button" class="btn small" @click="clearPoster">이미지 제거</button>
        </div>
      </div>
      <div class="field">
        <label for="title">제목</label>
        <input
          id="title"
          v-model="title"
          type="text"
          required
          maxlength="200"
          placeholder="영화 제목"
          autocomplete="off"
        />
      </div>
      <div class="field">
        <label for="intro">소개</label>
        <textarea
          id="intro"
          v-model="introduction"
          required
          rows="10"
          maxlength="10000"
          placeholder="줄거리, 감상, 추천 이유 등을 자유롭게 적어 주세요."
        />
      </div>
      <p v-if="error" class="status error">{{ error }}</p>
      <div class="actions">
        <RouterLink class="btn" to="/">취소</RouterLink>
        <button type="submit" class="btn primary" :disabled="submitting">
          {{ submitting ? '저장 중…' : '등록' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.write {
  padding: 2rem 1.5rem 3rem;
  text-align: left;
  max-width: 640px;
  margin: 0 auto;
}

.back {
  display: inline-block;
  margin-bottom: 1.25rem;
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}

.back:hover {
  text-decoration: underline;
}

.write h1 {
  margin: 0 0 0.75rem;
  font-size: 1.75rem;
}

.lead {
  color: var(--text);
  line-height: 1.55;
  margin: 0 0 1.75rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-weight: 600;
  color: var(--text-h);
  font-size: 0.95rem;
}

.file-input {
  font: inherit;
  max-width: 100%;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text);
}

.poster-preview-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.poster-preview {
  max-width: 100%;
  max-height: 280px;
  object-fit: contain;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--code-bg);
}

.btn.small {
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
}

.field input[type='text'],
.field textarea {
  font: inherit;
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-h);
}

.field textarea {
  line-height: 1.55;
  resize: vertical;
  min-height: 180px;
}

.field input:focus,
.field textarea:focus {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.status.error {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: rgba(185, 28, 28, 0.08);
  color: #b91c1c;
}

.actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
</style>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { isFirebaseConfigured } from '../firebase/config'
import {
  MAX_POSTER_FILE_BYTES,
  clearMoviePoster,
  getMovieWithPosterUrl,
  setMoviePoster,
  updateMovieContent,
} from '../services/movies'

const props = defineProps({
  id: { type: String, required: true },
})

const router = useRouter()
const route = useRoute()

const title = ref('')
const introduction = ref('')
const loading = ref(true)
const loadError = ref(null)

const existingPosterUrl = ref(null)
const existingPosterImageId = ref(null)

const newPosterFile = ref(null)
const newPosterPreviewUrl = ref(null)
const posterInputRef = ref(null)
const removePoster = ref(false)

const submitting = ref(false)
const error = ref(null)

function revokeNewPreview() {
  if (newPosterPreviewUrl.value) {
    URL.revokeObjectURL(newPosterPreviewUrl.value)
    newPosterPreviewUrl.value = null
  }
}

async function load() {
  loading.value = true
  loadError.value = null
  revokeNewPreview()
  newPosterFile.value = null
  removePoster.value = false
  if (posterInputRef.value) posterInputRef.value.value = ''

  if (!isFirebaseConfigured()) {
    loading.value = false
    loadError.value =
      'Firebase가 설정되지 않았습니다. .env를 확인한 뒤 다시 시도하세요.'
    return
  }

  try {
    const m = await getMovieWithPosterUrl(props.id)
    if (!m) {
      loadError.value = '글을 찾을 수 없습니다.'
      return
    }
    title.value = m.title
    introduction.value = m.introduction
    existingPosterUrl.value = m.posterUrl
    existingPosterImageId.value = m.posterImageId
  } catch (e) {
    loadError.value = e.message ?? String(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)

watch(
  () => route.params.id,
  () => load(),
)

onUnmounted(() => {
  revokeNewPreview()
})

function onPosterChange(e) {
  const file = e.target.files?.[0]
  newPosterFile.value = null
  revokeNewPreview()
  removePoster.value = false

  if (!file) return
  if (!file.type.startsWith('image/')) {
    error.value = '이미지 파일만 선택할 수 있습니다.'
    if (posterInputRef.value) posterInputRef.value.value = ''
    return
  }
  if (file.size > MAX_POSTER_FILE_BYTES) {
    error.value = `이미지는 ${MAX_POSTER_FILE_BYTES / 1024}KB 이하만 저장할 수 있습니다. (Firestore 한도)`
    if (posterInputRef.value) posterInputRef.value.value = ''
    return
  }
  error.value = null
  newPosterFile.value = file
  newPosterPreviewUrl.value = URL.createObjectURL(file)
}

function clearNewPoster() {
  newPosterFile.value = null
  revokeNewPreview()
  if (posterInputRef.value) posterInputRef.value.value = ''
}

async function onSubmit() {
  const t = title.value.trim()
  const intro = introduction.value.trim()
  if (!t || !intro || submitting.value || loading.value) return
  if (!isFirebaseConfigured()) {
    error.value = 'Firebase가 설정되지 않았습니다.'
    return
  }

  submitting.value = true
  error.value = null

  try {
    await updateMovieContent(props.id, { title: t, introduction: intro })

    if (newPosterFile.value) {
      await setMoviePoster(props.id, newPosterFile.value)
    } else if (removePoster.value && existingPosterImageId.value) {
      await clearMoviePoster(props.id, existingPosterImageId.value)
    }

    router.replace(`/movie/${props.id}`)
  } catch (e) {
    error.value = e.message ?? String(e)
  } finally {
    submitting.value = false
  }
}

const displayPosterPreview = () =>
  newPosterPreviewUrl.value || (removePoster.value ? null : existingPosterUrl.value)
</script>

<template>
  <div class="write">
    <RouterLink class="back" :to="`/movie/${id}`">← 글 보기</RouterLink>
    <h1>영화 소개 글 수정</h1>

    <p v-if="loading" class="status">불러오는 중…</p>
    <p v-else-if="loadError" class="status error">{{ loadError }}</p>

    <form v-else class="form" @submit.prevent="onSubmit">
      <div class="field">
        <label for="poster-edit">포스터 이미지</label>
        <input
          id="poster-edit"
          ref="posterInputRef"
          type="file"
          accept="image/*"
          class="file-input"
          @change="onPosterChange"
        />
        <p class="hint">
          새 파일을 선택하면 기존 이미지를 덮어씁니다. Firestore에만 저장되며, 약
          {{ MAX_POSTER_FILE_BYTES / 1024 }}KB 이하를 권장합니다.
        </p>

        <label v-if="existingPosterUrl || displayPosterPreview()" class="check-row">
          <input v-model="removePoster" type="checkbox" :disabled="!!newPosterFile" />
          <span>등록된 포스터 이미지 제거</span>
        </label>

        <div v-if="displayPosterPreview()" class="poster-preview-wrap">
          <img :src="displayPosterPreview()" alt="" class="poster-preview" />
        </div>
        <button
          v-if="newPosterFile"
          type="button"
          class="btn small"
          @click="clearNewPoster"
        >
          새로 선택한 이미지 취소
        </button>
      </div>

      <div class="field">
        <label for="title-edit">제목</label>
        <input
          id="title-edit"
          v-model="title"
          type="text"
          required
          maxlength="200"
          autocomplete="off"
        />
      </div>
      <div class="field">
        <label for="intro-edit">소개</label>
        <textarea
          id="intro-edit"
          v-model="introduction"
          required
          rows="10"
          maxlength="10000"
        />
      </div>
      <p v-if="error" class="status error">{{ error }}</p>
      <div class="actions">
        <RouterLink class="btn" :to="`/movie/${id}`">취소</RouterLink>
        <button type="submit" class="btn primary" :disabled="submitting">
          {{ submitting ? '저장 중…' : '저장' }}
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
  margin: 0 0 1rem;
  font-size: 1.75rem;
}

.status {
  padding: 1rem;
  border-radius: 8px;
  background: var(--code-bg);
}

.status.error {
  color: #b91c1c;
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

.check-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  font-size: 0.9rem;
  cursor: pointer;
  margin-top: 0.35rem;
}

.poster-preview-wrap {
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
  align-self: flex-start;
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

import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import MovieDetailView from '../views/MovieDetailView.vue'
import CreateMovieView from '../views/CreateMovieView.vue'
import EditMovieView from '../views/EditMovieView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/write', name: 'write', component: CreateMovieView },
    {
      path: '/movie/:id/edit',
      name: 'movie-edit',
      component: EditMovieView,
      props: true,
    },
    {
      path: '/movie/:id',
      name: 'movie',
      component: MovieDetailView,
      props: true,
    },
  ],
})

export default router

import axios from 'axios'
import { auth } from '@/firebase'

export const api = axios.create({
  baseURL: '/api/v1',
})

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

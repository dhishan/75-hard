import { useRef } from 'react'
import { api } from '@/api/client'

interface Props {
  upId: string
  logDate: string
  taskId: string
}

export default function EvidenceUpload({ upId, logDate, taskId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    const { data } = await api.post(`/user-programs/${upId}/logs/${logDate}/evidence`, {
      task_id: taskId,
      type: 'photo',
      content_type: file.type,
    })
    if (data.upload_url) {
      await fetch(data.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
    }
    alert('Evidence uploaded!')
  }

  return (
    <div className="mt-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleUpload(file)
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        className="text-xs underline text-gray-400"
      >
        + Attach photo
      </button>
    </div>
  )
}

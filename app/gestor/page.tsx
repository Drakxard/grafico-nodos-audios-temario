"use client"

import { useEffect, useRef } from "react"
import { attachAudioLayer } from "@/lib/audio"

export default function GestorPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<any>(null)

  useEffect(() => {
    if (!rootRef.current) return
    const instance = attachAudioLayer({
      nodesSelection: rootRef.current.querySelectorAll('[data-extid]') as NodeListOf<HTMLElement>,
      getExtId: (el) => el.dataset.extid || "",
      rootElement: rootRef.current,
      options: { allowLocalFileSystem: true }
    })
    instanceRef.current = instance
    return () => instance.dispose()
  }, [])

  return (
    <div ref={rootRef} className="p-4 space-y-4">
      <button
        onClick={() => instanceRef.current?.requestFolderPermission()}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Configurar carpeta local
      </button>
      <div className="flex gap-4">
        <div data-extid="n1" className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center cursor-pointer">
          1
        </div>
        <div data-extid="n2" className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center cursor-pointer">
          2
        </div>
        <div data-extid="n3" className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center cursor-pointer">
          3
        </div>
      </div>
    </div>
  )
}

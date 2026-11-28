import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'

// Layout di tutto il bo (/bo/**). Il Toaster (sonner) sta qui e non in main.tsx: così sonner
// resta fuori dal chunk d'ingresso della home pubblica.
export const Route = createFileRoute('/bo')({
  component: LayoutBo,
})

function LayoutBo() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  )
}

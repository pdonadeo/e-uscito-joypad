// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { Avatar as AvatarPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

// «Avatar → avatar»: 32 × 32, fondo viola, bordo crema di 2 px, iniziali bianche.
function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn('relative flex size-32 shrink-0 overflow-hidden border-2 border-crema bg-viola select-none', className)}
      {...props}
    />
  )
}

function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn('flex size-full items-center justify-center font-ui text-sm font-extrabold text-bianco', className)}
      {...props}
    />
  )
}

export { Avatar, AvatarFallback }

import { RouterProvider } from 'react-router-dom'
import { router } from '@/router'
import { Toaster } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'

function App() {
  return (
    <TooltipProvider>
      <Toaster>
        <RouterProvider router={router} />
      </Toaster>
    </TooltipProvider>
  )
}

export default App

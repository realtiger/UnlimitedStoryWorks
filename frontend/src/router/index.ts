import Home from '@/pages/Home'
import About from '@/pages/About'
import { Layout } from '@/components/layout'
import { createBrowserRouter } from "react-router-dom"
import { createElement } from 'react'

const routes = [
  {
    path: "/",
    element: createElement(Layout),
    children: [
      {
        path: "/",
        element: createElement(Home),
      },
      {
        path: "/about",
        element: createElement(About),
      },
    ],
  },
]

export const router = createBrowserRouter(routes)

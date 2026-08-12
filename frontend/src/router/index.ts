import Home from '@/pages/Home'
import About from '@/pages/About'
import Settings from '@/pages/Settings'
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
      {
        path: "/settings",
        element: createElement(Settings),
      },
    ],
  },
]

export const router = createBrowserRouter(routes)

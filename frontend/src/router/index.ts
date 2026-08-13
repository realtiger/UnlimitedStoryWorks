import Home from '@/pages/Home'
import About from '@/pages/About'
import Projects from '@/pages/Projects'
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
        path: "/projects",
        element: createElement(Projects),
      },
    ],
  },
]

export const router = createBrowserRouter(routes)

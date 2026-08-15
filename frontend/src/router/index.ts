import Home from '@/pages/Home'
import About from '@/pages/About'
import Projects from '@/pages/Projects'
import Scripts from '@/pages/Scripts'
import AI from '@/pages/AI'
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
      {
        path: "/scripts",
        element: createElement(Scripts),
      },
      {
        path: "/ai-config",
        element: createElement(AI),
      },
    ],
  },
]

export const router = createBrowserRouter(routes)

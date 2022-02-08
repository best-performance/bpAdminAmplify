import React from 'react'
import CIcon from '@coreui/icons-react'
import { cilCursor, cilDrop, cilPencil, cilPuzzle, cilHome, cilGolf } from '@coreui/icons'
import { CNavGroup, CNavItem, CNavTitle } from '@coreui/react'

const _nav = [
  {
    component: CNavItem,
    name: 'Login/Logout',
    to: '/Login',
    icon: <CIcon icon={cilGolf} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'LandingPage',
    to: '/LandingPage',
    icon: <CIcon icon={cilHome} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Wonde Integration',
  },
  {
    component: CNavItem,
    name: 'New School Uptake',
    to: '/wonde/newSchool',
    icon: <CIcon icon={cilDrop} customClassName="nav-icon" />,
  },
  {
    component: CNavItem,
    name: 'School Updates',
    to: '/wonde/updateSchool',
    icon: <CIcon icon={cilPencil} customClassName="nav-icon" />,
  },
  {
    component: CNavTitle,
    name: 'Test Uploaders',
  },
  {
    component: CNavGroup,
    name: 'Uploaders',
    to: '/tests',
    icon: <CIcon icon={cilPuzzle} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'PAT',
        to: '/tests/patTest',
      },
      {
        component: CNavItem,
        name: 'NAPLAN',
        to: '/tests/naplanTest',
      },
    ],
  },
  {
    component: CNavTitle,
    name: 'Custom Queries',
  },
  {
    component: CNavGroup,
    name: 'Queries',
    to: '/queries',
    icon: <CIcon icon={cilCursor} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Query 1',
        to: '/queries/query1',
      },
      {
        component: CNavItem,
        name: 'Query 2',
        to: '/queries/query2',
      },
      {
        component: CNavItem,
        name: 'Query 3',
        to: '/queries/query3',
      },
    ],
  },
]

export default _nav

import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilCursor,
  cilDrop,
  cilPencil,
  cilPuzzle,
  cilHome,
  cilGolf,
  cilPeople,
  cilSchool,
} from '@coreui/icons'
import { CNavGroup, CNavItem, CNavTitle } from '@coreui/react'

const _nav = [
  {
    visibleWithoutLogin: true,
    component: CNavItem,
    name: 'Login',
    to: '/Login',
    icon: <CIcon icon={cilGolf} customClassName="nav-icon" />,
  },
  {
    visibleWithoutLogin: true,
    component: CNavItem,
    name: 'LandingPage',
    to: '/LandingPage',
    icon: <CIcon icon={cilHome} customClassName="nav-icon" />,
  },
  {
    visibleWithoutLogin: false,
    component: CNavTitle,
    name: 'Wonde Integration',
  },
  {
    visibleWithoutLogin: false,
    component: CNavItem,
    name: 'New School Uptake',
    to: '/wonde/newSchool',
    icon: <CIcon icon={cilDrop} customClassName="nav-icon" />,
  },
  {
    visibleWithoutLogin: false,
    component: CNavItem,
    name: 'School Updates',
    to: '/wonde/updateSchool',
    icon: <CIcon icon={cilPencil} customClassName="nav-icon" />,
  },
  {
    visibleWithoutLogin: false,
    component: CNavTitle,
    name: 'Test Uploaders',
  },
  {
    visibleWithoutLogin: false,
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
    visibleWithoutLogin: false,
    component: CNavTitle,
    name: 'Custom Queries',
  },
  {
    visibleWithoutLogin: false,
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
  {
    visibleWithoutLogin: false,
    component: CNavTitle,
    name: 'Users Module',
  },
  {
    visibleWithoutLogin: false,
    component: CNavGroup,
    name: 'Users',
    to: '/users',
    icon: <CIcon icon={cilPeople} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Create User',
        to: '/users/createUser',
      },
      {
        component: CNavItem,
        name: 'Manage Users',
        to: '/users/manageUsers',
      },
    ],
  },
  {
    visibleWithoutLogin: false,
    component: CNavTitle,
    name: 'Schools',
  },
  {
    visibleWithoutLogin: false,
    component: CNavGroup,
    name: 'Schools',
    to: '/schools',
    icon: <CIcon icon={cilSchool} customClassName="nav-icon" />,
    items: [
      {
        component: CNavItem,
        name: 'Upload Data',
        to: '/schools/uploadData',
      },
    ],
  },
]

export default _nav

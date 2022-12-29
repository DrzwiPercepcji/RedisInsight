import { cloneDeep } from 'lodash'
import React from 'react'
import { instance, mock } from 'ts-mockito'
import { cleanup, mockedStore, render, screen, fireEvent } from 'uiSrc/utils/test-utils'
import { checkDatabaseIndex, connectedInstanceInfoSelector } from 'uiSrc/slices/instances/instances'

import { BuildType } from 'uiSrc/constants/env'
import InstanceHeader, { Props } from './InstanceHeader'

const mockedProps = mock<Props>()

let store: typeof mockedStore
beforeEach(() => {
  cleanup()
  store = cloneDeep(mockedStore)
  store.clearActions()
})

jest.mock('uiSrc/services', () => ({
  ...jest.requireActual('uiSrc/services'),
  sessionStorageService: {
    set: jest.fn(),
    get: jest.fn(),
  },
}))

jest.mock('uiSrc/slices/instances/instances', () => ({
  ...jest.requireActual('uiSrc/slices/instances/instances'),
  connectedInstanceInfoSelector: jest.fn().mockReturnValue({
    databases: 16,
  })
}))

describe('InstanceHeader', () => {
  it('should render', () => {
    expect(render(<InstanceHeader {...instance(mockedProps)} />)).toBeTruthy()
  })

  it('should render change index button with databases = 1', () => {
    (connectedInstanceInfoSelector as jest.Mock).mockReturnValueOnce({
      databases: 1,
    })

    render(<InstanceHeader {...instance(mockedProps)} />)

    expect(screen.queryByTestId('change-index-btn')).not.toBeInTheDocument()
  })

  it('should render change index button', () => {
    render(<InstanceHeader {...instance(mockedProps)} />)

    expect(screen.getByTestId('change-index-btn')).toBeInTheDocument()
  })

  it('should render change index input after click on the button', () => {
    render(<InstanceHeader {...instance(mockedProps)} />)

    fireEvent.click(screen.getByTestId('change-index-btn'))

    expect(screen.getByTestId('change-index-input')).toBeInTheDocument()
  })

  it('should call proper actions after changing database index', () => {
    render(<InstanceHeader {...instance(mockedProps)} />)

    fireEvent.click(screen.getByTestId('change-index-btn'))

    fireEvent.change(
      screen.getByTestId('change-index-input'),
      { target: { value: 3 } }
    )

    expect(screen.getByTestId('change-index-input')).toHaveValue('3')
    fireEvent.click(screen.getByTestId('apply-btn'))

    const expectedActions = [
      checkDatabaseIndex()
    ]
    expect(store.getActions()).toEqual([...expectedActions])
  })
})

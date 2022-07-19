import React, { useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { toNumber } from 'lodash'
import cx from 'classnames'
import { EuiButtonIcon, EuiProgress, EuiText, EuiToolTip } from '@elastic/eui'
import { CellMeasurerCache } from 'react-virtualized'

import {
  zsetSelector,
  fetchZSetMembers,
  fetchMoreZSetMembers,
  zsetDataSelector,
  deleteZSetMembers,
  updateZsetScoreStateSelector,
  updateZSetMembers,
  fetchSearchZSetMembers,
  fetchSearchMoreZSetMembers,
} from 'uiSrc/slices/browser/zset'
import { KeyTypes, SortOrder, TableCellAlignment } from 'uiSrc/constants'
import { SCAN_COUNT_DEFAULT } from 'uiSrc/constants/api'
import HelpTexts from 'uiSrc/constants/help-texts'
import { NoResultsFoundText } from 'uiSrc/constants/texts'
import { selectedKeyDataSelector, keysSelector } from 'uiSrc/slices/browser/keys'
import { createDeleteFieldHeader, createDeleteFieldMessage, formatLongName, validateScoreNumber } from 'uiSrc/utils'
import { sendEventTelemetry, TelemetryEvent, getBasedOnViewTypeEvent, getMatchType } from 'uiSrc/telemetry'
import { connectedInstanceSelector } from 'uiSrc/slices/instances/instances'
import VirtualTable from 'uiSrc/components/virtual-table/VirtualTable'
import InlineItemEditor from 'uiSrc/components/inline-item-editor/InlineItemEditor'
import { IColumnSearchState, ITableColumn } from 'uiSrc/components/virtual-table/interfaces'
import { StopPropagation } from 'uiSrc/components/virtual-table'
import { columnWidth } from 'uiSrc/components/virtual-grid'
import { AddMembersToZSetDto, SearchZSetMembersResponse, ZSetMemberDto } from 'apiSrc/modules/browser/dto'
import PopoverDelete from '../popover-delete/PopoverDelete'

import styles from './styles.module.scss'

const suffix = '_zset'
const headerHeight = 60
const rowHeight = 43

const cellCache = new CellMeasurerCache({
  fixedWidth: true,
  minHeight: rowHeight,
})

interface IZsetMember extends ZSetMemberDto {
  editing: boolean;
}

export interface Props {
  isFooterOpen: boolean
}

const ZSetDetails = (props: Props) => {
  const { isFooterOpen } = props

  const { loading, searching } = useSelector(zsetSelector)
  const { loading: updateLoading } = useSelector(updateZsetScoreStateSelector)
  const [sortedColumnOrder, setSortedColumnOrder] = useState(SortOrder.ASC)
  const { name: key, length } = useSelector(selectedKeyDataSelector) ?? { name: '' }
  const { total, nextCursor, members: loadedMembers } = useSelector(zsetDataSelector)
  const { id: instanceId } = useSelector(connectedInstanceSelector)
  const { viewType } = useSelector(keysSelector)

  const [match, setMatch] = useState<string>('')
  const [deleting, setDeleting] = useState('')
  const [members, setMembers] = useState<IZsetMember[]>([])
  const [sortedColumnName, setSortedColumnName] = useState('score')
  const [width, setWidth] = useState(100)
  const [expandedRows, setExpandedRows] = useState<number[]>([])

  const dispatch = useDispatch()

  useEffect(() => {
    const zsetMembers: IZsetMember[] = loadedMembers.map((item) => ({
      ...item,
      editing: false,
    }))
    setMembers(zsetMembers)
  }, [loadedMembers])

  const closePopover = useCallback(() => {
    setDeleting('')
  }, [])

  const showPopover = useCallback((member = '') => {
    setDeleting(`${member + suffix}`)
  }, [])

  const onSuccessRemoved = () => {
    sendEventTelemetry({
      event: getBasedOnViewTypeEvent(
        viewType,
        TelemetryEvent.BROWSER_KEY_VALUE_REMOVED,
        TelemetryEvent.TREE_VIEW_KEY_VALUE_REMOVED
      ),
      eventData: {
        databaseId: instanceId,
        keyType: KeyTypes.ZSet,
        numberOfRemoved: 1,
      }
    })
  }

  const handleDeleteMember = (member = '') => {
    dispatch(deleteZSetMembers(key, [member], onSuccessRemoved))
    closePopover()
  }

  const handleEditMember = (name = '', editing: boolean) => {
    const newMemberState = members.map((item) => {
      if (item.name === name) {
        return { ...item, editing }
      }
      return item
    })
    setMembers(newMemberState)
    cellCache.clearAll()
  }

  const handleApplyEditScore = (name = '', score: string) => {
    const data: AddMembersToZSetDto = {
      keyName: key,
      members: [{
        name,
        score: toNumber(score),
      }]
    }
    dispatch(
      updateZSetMembers(
        data,
        () => handleEditMember(name, false)
      )
    )
  }

  const handleRemoveIconClick = () => {
    sendEventTelemetry({
      event: getBasedOnViewTypeEvent(
        viewType,
        TelemetryEvent.BROWSER_KEY_VALUE_REMOVE_CLICKED,
        TelemetryEvent.TREE_VIEW_KEY_VALUE_REMOVE_CLICKED
      ),
      eventData: {
        databaseId: instanceId,
        keyType: KeyTypes.ZSet
      }
    })
  }

  const handleSearch = (search: IColumnSearchState[]) => {
    const fieldColumn = search.find((column) => column.id === 'name')
    if (!fieldColumn) { return }

    const { value: match } = fieldColumn
    const onSuccess = (data: SearchZSetMembersResponse) => {
      const matchValue = getMatchType(match)
      sendEventTelemetry({
        event: getBasedOnViewTypeEvent(
          viewType,
          TelemetryEvent.BROWSER_KEY_VALUE_FILTERED,
          TelemetryEvent.TREE_VIEW_KEY_VALUE_FILTERED
        ),
        eventData: {
          databaseId: instanceId,
          keyType: KeyTypes.ZSet,
          match: matchValue,
          length: data.total,
        }
      })
    }
    setMatch(match)
    if (match === '') {
      dispatch(
        fetchZSetMembers(key, 0, SCAN_COUNT_DEFAULT, sortedColumnOrder)
      )
      return
    }
    dispatch(
      fetchSearchZSetMembers(key, 0, SCAN_COUNT_DEFAULT, match, onSuccess)
    )
  }

  const handleRowToggleViewClick = (expanded: boolean, rowIndex: number) => {
    const browserViewEvent = expanded
      ? TelemetryEvent.BROWSER_KEY_FIELD_VALUE_EXPANDED
      : TelemetryEvent.BROWSER_KEY_FIELD_VALUE_COLLAPSED
    const treeViewEvent = expanded
      ? TelemetryEvent.TREE_VIEW_KEY_FIELD_VALUE_EXPANDED
      : TelemetryEvent.TREE_VIEW_KEY_FIELD_VALUE_COLLAPSED

    sendEventTelemetry({
      event: getBasedOnViewTypeEvent(viewType, browserViewEvent, treeViewEvent),
      eventData: {
        keyType: KeyTypes.ZSet,
        databaseId: instanceId,
        largestCellLength: members[rowIndex]?.name?.length || 0,
      }
    })
  }

  const columns:ITableColumn[] = [
    {
      id: 'name',
      label: 'Member',
      isSearchable: true,
      prependSearchName: 'Member:',
      initialSearchValue: '',
      truncateText: true,
      alignment: TableCellAlignment.Left,
      className: 'value-table-separate-border',
      headerClassName: 'value-table-separate-border',
      render: function Name(_name: string, { name }: IZsetMember, expanded?: boolean) {
        // Better to cut the long string, because it could affect virtual scroll performance
        const cellContent = name.substring(0, 200)
        const tooltipContent = formatLongName(name)
        return (
          <EuiText color="subdued" size="s" style={{ maxWidth: '100%', whiteSpace: 'break-spaces' }}>
            <div
              style={{ display: 'flex' }}
              data-testid={`zset-member-value-${name}`}
            >
              {!expanded && (
                <EuiToolTip
                  title="Member"
                  className={styles.tooltip}
                  anchorClassName="truncateText"
                  position="bottom"
                  content={tooltipContent}
                >
                  <>{cellContent}</>
                </EuiToolTip>
              )}
              {expanded && name}
            </div>
          </EuiText>
        )
      },
    },
    {
      id: 'score',
      label: 'Score',
      isSortable: true,
      truncateText: true,
      render: function Score(_name: string, { name, score, editing }: IZsetMember, expanded?: boolean) {
        const cellContent = score.toString().substring(0, 200)
        const tooltipContent = formatLongName(score.toString())
        if (editing) {
          return (
            <StopPropagation>
              <InlineItemEditor
                initialValue={score.toString()}
                controlsPosition="right"
                placeholder="Enter Score"
                fieldName="score"
                expandable
                onDecline={() => handleEditMember(name, false)}
                onApply={(value) => handleApplyEditScore(name, value)}
                validation={validateScoreNumber}
              />
            </StopPropagation>
          )
        }
        return (
          <EuiText color="subdued" size="s" style={{ maxWidth: '100%', whiteSpace: 'break-spaces' }}>
            <div
              style={{ display: 'flex' }}
              data-testid={`zset-score-value-${score}`}
            >
              {!expanded && (
                <EuiToolTip
                  title="Score"
                  className={styles.tooltip}
                  anchorClassName="truncateText"
                  position="bottom"
                  content={tooltipContent}
                >
                  <>{cellContent}</>
                </EuiToolTip>
              )}
              {expanded && score}
            </div>
          </EuiText>
        )
      }
    },
    {
      id: 'actions',
      label: '',
      headerClassName: 'value-table-header-actions',
      className: 'actions',
      minWidth: 100,
      maxWidth: 100,
      absoluteWidth: 100,
      render: function Actions(_act: any, { name }: IZsetMember) {
        return (
          <StopPropagation>
            <div className="value-table-actions">
              <EuiButtonIcon
                iconType="pencil"
                aria-label="Edit field"
                className="editFieldBtn"
                color="primary"
                disabled={updateLoading}
                onClick={() => handleEditMember(name, true)}
                data-testid={`zset-edit-button-${name}`}
              />
              <PopoverDelete
                header={createDeleteFieldHeader(name)}
                text={createDeleteFieldMessage(key)}
                item={name}
                suffix={suffix}
                deleting={deleting}
                closePopover={closePopover}
                updateLoading={false}
                showPopover={showPopover}
                handleDeleteItem={handleDeleteMember}
                handleButtonClick={handleRemoveIconClick}
                testid={`zset-remove-button-${name}`}
                appendInfo={length === 1 ? HelpTexts.REMOVE_LAST_ELEMENT('Member') : null}
              />
            </div>
          </StopPropagation>
        )
      },
    },
  ]

  const onChangeSorting = (column: any, order: SortOrder) => {
    setSortedColumnName(column)
    setSortedColumnOrder(order)

    dispatch(fetchZSetMembers(key, 0, SCAN_COUNT_DEFAULT, order))
  }

  const loadMoreItems = ({ startIndex, stopIndex }: any) => {
    if (!searching) {
      dispatch(
        fetchMoreZSetMembers(
          key,
          startIndex,
          stopIndex - startIndex + 1,
          sortedColumnOrder
        )
      )
      return
    }
    if (nextCursor !== 0) {
      dispatch(
        fetchSearchMoreZSetMembers(
          key,
          nextCursor,
          SCAN_COUNT_DEFAULT,
          match
        )
      )
    }
  }

  const sortedColumn = {
    column: sortedColumnName,
    order: sortedColumnOrder,
  }

  return (
    <>
      <div
        className={cx(
          'key-details-table',
          'hash-fields-container',
          styles.container,
          { footerOpened: isFooterOpen }
        )}
      >
        {loading && (
          <EuiProgress
            color="primary"
            size="xs"
            position="absolute"
            data-testid="progress-key-zset"
          />
        )}
        <VirtualTable
          hideProgress
          expandable
          keyName={key}
          headerHeight={headerHeight}
          rowHeight={rowHeight}
          onChangeWidth={setWidth}
          columns={columns.map((column, i, arr) => ({
            ...column,
            width: columnWidth(i, width, arr)
          }))}
          footerHeight={0}
          loadMoreItems={loadMoreItems}
          loading={loading}
          searching={searching}
          items={members}
          sortedColumn={sortedColumn}
          onChangeSorting={onChangeSorting}
          totalItemsCount={total}
          noItemsMessage={NoResultsFoundText}
          onWheel={closePopover}
          onSearch={handleSearch}
          cellCache={cellCache}
          onRowToggleViewClick={handleRowToggleViewClick}
          expandedRows={expandedRows}
          setExpandedRows={setExpandedRows}
        />
      </div>
    </>
  )
}

export default ZSetDetails

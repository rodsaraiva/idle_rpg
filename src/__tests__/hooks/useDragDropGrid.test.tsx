import React, { useState } from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Text, Button } from 'react-native';
import { useDragDropGrid } from '../../hooks/useDragDropGrid';

function TestComponent() {
  const [drop, setDrop] = useState<{ item: any; idx: number } | null>(null);
  const {
    pan,
    dragging,
    draggingItem,
    startDrag,
    cancelDrag,
    panHandlers,
    setContainerRef,
    setCellLayout,
    hoveredIndex,
  } = useDragDropGrid<any>((item, droppedIndex) => {
    setDrop({ item, idx: droppedIndex });
  });

  const mockContainer = {
    measureInWindow: (cb: (x: number, y: number) => void) => cb(100, 200),
  } as any;

  const item = { id: 'h1', name: 'Alpha' };

  return (
    <>
      <Text testID="dragging">{dragging ? 'true' : 'false'}</Text>
      <Text testID="hovered">{hoveredIndex === null ? 'null' : String(hoveredIndex)}</Text>
      <Text testID="drop">{drop ? `${drop.item.id}@${drop.idx}` : 'none'}</Text>
      <Button
        title="setContainer"
        onPress={() => {
          setContainerRef(mockContainer);
        }}
      />
      <Button
        title="setCell"
        onPress={() => {
          setCellLayout(0, { x: 10, y: 10, width: 50, height: 50 });
        }}
      />
      <Button
        title="start"
        onPress={() => {
          // start near center of the first cell (global coords)
          startDrag(item, 100 + 10 + 20, 200 + 10 + 20);
        }}
      />
      <Button
        title="drop"
        onPress={() => {
          // simulate panResponder release
          panHandlers.onPanResponderRelease &&
            // @ts-ignore synthetic args
            panHandlers.onPanResponderRelease(null, { moveX: 100 + 10 + 20, moveY: 200 + 10 + 20 });
        }}
      />
      <Button title="cancel" onPress={() => cancelDrag()} />
    </>
  );
}

test('useDragDropGrid start/stop and drop flow', async () => {
  const r = render(<TestComponent />);

  // setup container and cell
  fireEvent.press(r.getByText('setContainer'));
  fireEvent.press(r.getByText('setCell'));

  // start drag
  fireEvent.press(r.getByText('start'));
  expect(r.getByTestId('dragging').props.children).toBe('true');

  // perform drop
  fireEvent.press(r.getByText('drop'));

  await waitFor(() => {
    expect(r.getByTestId('drop').props.children).toBe('h1@0');
  });

  // after drop dragging should be false
  expect(r.getByTestId('dragging').props.children).toBe('false');
});


import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useRef } from 'react';
import { View, Text, Button } from 'react-native';
import { useDragDropGrid } from '../../hooks/useDragDropGrid';

function Harness() {
  const [dropped, setDropped] = React.useState<{ id: string; idx: number } | null>(null);
  const { startDrag, panHandlers, setContainerRef, setCellLayout } = useDragDropGrid<any>((item, idx) => {
    setDropped({ id: item.id, idx });
  });

  // mock container that throws on measureInWindow
  const badContainer = {
    measureInWindow: (_cb: any) => {
      throw new Error('measure fail');
    },
  } as any;

  return (
    <>
      <Button title="setContainerBad" onPress={() => setContainerRef(badContainer)} />
      <Button
        title="setCell"
        onPress={() => {
          setCellLayout(0, { x: 10, y: 10, width: 50, height: 50 });
        }}
      />
      <Button
        title="start"
        onPress={() => {
          startDrag({ id: 'h1', name: 'H' }, 100, 100);
        }}
      />
      <Button
        title="release"
        onPress={() => {
          // no real panHandlers API exposed for testing; rely on hook internal stability
        }}
      />
      <Text testID="dropped">{dropped ? `${dropped.id}@${dropped.idx}` : 'none'}</Text>
    </>
  );
}

test('useDragDropGrid handles measureInWindow failure gracefully', async () => {
  const r = render(<Harness />);
  fireEvent.press(r.getByText('setContainerBad'));
  fireEvent.press(r.getByText('setCell'));
  fireEvent.press(r.getByText('start'));
  // should not throw; dropped remains none
  await waitFor(() => {
    expect(r.getByTestId('dropped').props.children).toBe('none');
  });
});


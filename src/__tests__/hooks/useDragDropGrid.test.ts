import { renderHook, act } from '@testing-library/react-native';
import { useDragDropGrid } from '../../hooks/useDragDropGrid';

describe('useDragDropGrid', () => {
  test('estado inicial: não está arrastando, sem item', () => {
    const { result } = renderHook(() => useDragDropGrid());
    expect(result.current.dragging).toBe(false);
    expect(result.current.draggingItem).toBeNull();
    expect(result.current.hoveredIndex).toBeNull();
  });

  test('startDrag ativa o estado de arrasto', () => {
    const { result } = renderHook(() => useDragDropGrid<string>());
    act(() => {
      result.current.startDrag('item-a', 100, 200);
    });
    expect(result.current.dragging).toBe(true);
    expect(result.current.draggingItem).toBe('item-a');
  });

  test('cancelDrag reseta o estado', () => {
    const { result } = renderHook(() => useDragDropGrid<string>());
    act(() => {
      result.current.startDrag('item-b', 50, 50);
    });
    act(() => {
      result.current.cancelDrag();
    });
    expect(result.current.dragging).toBe(false);
    expect(result.current.draggingItem).toBeNull();
  });

  test('setCellLayout registra layout de célula sem erros', () => {
    const { result } = renderHook(() => useDragDropGrid<number>());
    // Não deve lançar; a função é void
    expect(() => {
      act(() => {
        result.current.setCellLayout(0, { x: 0, y: 0, width: 100, height: 50 });
        result.current.setCellLayout(1, { x: 100, y: 0, width: 100, height: 50 });
      });
    }).not.toThrow();
  });

  test('onDrop callback não é invocado sem containerRef (cancelDrag silencioso)', () => {
    const onDrop = jest.fn();
    const { result } = renderHook(() => useDragDropGrid<string>(onDrop));

    act(() => {
      result.current.setCellLayout(0, { x: 0, y: 0, width: 200, height: 100 });
    });

    // Sem containerRef (null), performDropAssign retorna -1 → onDrop NÃO é chamado
    act(() => {
      result.current.startDrag('payload', 100, 50);
    });
    act(() => {
      result.current.cancelDrag();
    });
    expect(onDrop).not.toHaveBeenCalled(); // sem containerRef, drop silencioso
  });
});

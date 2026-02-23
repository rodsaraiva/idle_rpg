import { useRef, useState, useEffect } from 'react';
import { Animated, PanResponder, View } from 'react-native';
import { lightTap, successNotification } from '../services/haptics';

type CellLayout = { x: number; y: number; width: number; height: number };

type UseDragDropGridResult<T> = {
  pan: Animated.ValueXY;
  dragging: boolean;
  draggingItem: T | null;
  startDrag: (item: T, pageX: number, pageY: number) => void;
  cancelDrag: () => void;
  panHandlers: any;
  setContainerRef: (r: View | null) => void;
  setCellLayout: (index: number, layout: CellLayout) => void;
  hoveredIndex: number | null;
};

export function useDragDropGrid<T>(onDrop?: (item: T, droppedIndex: number) => void): UseDragDropGridResult<T> {
  const [dragging, setDragging] = useState(false);
  const [draggingItem, setDraggingItem] = useState<T | null>(null);
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const containerRef = useRef<View | null>(null);
  const containerAbsRef = useRef<{ x: number; y: number } | null>(null);
  const cellLayouts = useRef<CellLayout[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const measureContainer = () => {
    const r = containerRef.current;
    if (!r) {
      containerAbsRef.current = null;
      return;
    }
    try {
      // @ts-ignore measureInWindow exists
      r.measureInWindow((cx: number, cy: number) => {
        containerAbsRef.current = { x: cx, y: cy };
      });
    } catch {
      containerAbsRef.current = null;
    }
  };

  useEffect(() => {
    // re-measure occasionally in case layout changes; caller can call setContainerRef to trigger
    const t = setTimeout(measureContainer, 60);
    return () => clearTimeout(t);
  }, []);

  const performDropAssign = (mx: number, my: number) => {
    const car = containerAbsRef.current;
    if (!car) return -1;
    for (let i = 0; i < cellLayouts.current.length; i++) {
      const r = cellLayouts.current[i];
      const absX = car.x + r.x;
      const absY = car.y + r.y;
      if (mx >= absX && mx <= absX + r.width && my >= absY && my <= absY + r.height) {
        return i;
      }
    }
    return -1;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => dragging,
      onMoveShouldSetPanResponder: () => dragging,
      // allow parent to capture the gesture when dragging starts in a child
      onStartShouldSetPanResponderCapture: () => dragging,
      onMoveShouldSetPanResponderCapture: () => dragging,
      onPanResponderMove: (_, gestureState) => {
        pan.setValue({ x: gestureState.moveX - 40, y: gestureState.moveY - 20 });
        const car = containerAbsRef.current;
        if (car) {
          const mx = gestureState.moveX;
          const my = gestureState.moveY;
          const idx = performDropAssign(mx, my);
          setHoveredIndex(idx === -1 ? null : idx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const mx = gestureState.moveX;
        const my = gestureState.moveY;
        const droppedIndex = performDropAssign(mx, my);
        if (droppedIndex !== -1 && draggingItem && onDrop) {
          // animate to target then call onDrop
          const target = cellLayouts.current[droppedIndex];
          const car = containerAbsRef.current!;
          const ghostW = 100;
          const ghostH = 44;
          const targetX = car.x + target.x + target.width / 2 - ghostW / 2;
          const targetY = car.y + target.y + target.height / 2 - ghostH / 2;
          Animated.timing(pan, {
            toValue: { x: targetX, y: targetY },
            duration: 160,
            useNativeDriver: false,
          }).start(() => {
            try {
              onDrop(draggingItem, droppedIndex);
            } catch {
              // swallow errors from consumer
            }
            try {
              successNotification();
            } catch {
              /* non-critical */
            }
            try {
              // optionally play a snap sound if available
              // import dynamically to avoid circular deps in tests
              // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
              const { playSound } = require('../services/sound');
              if (playSound) playSound('chest_reveal' as any).catch(() => {});
            } catch {
              /* non-critical */
            }
            setDragging(false);
            setDraggingItem(null);
            pan.setValue({ x: 0, y: 0 });
            setHoveredIndex(null);
          });
        } else {
          setDragging(false);
          setDraggingItem(null);
          pan.setValue({ x: 0, y: 0 });
          setHoveredIndex(null);
        }
      },
    })
  ).current;

  const startDrag = (item: T, pageX: number, pageY: number) => {
    setDraggingItem(item);
    setDragging(true);
    pan.setValue({ x: pageX - 40, y: pageY - 20 });
    // ensure container absolute is measured
    measureContainer();
    try {
      lightTap();
    } catch {
      /* non-critical */
    }
  };

  const cancelDrag = () => {
    setDragging(false);
    setDraggingItem(null);
    pan.setValue({ x: 0, y: 0 });
    setHoveredIndex(null);
  };

  return {
    pan,
    dragging,
    draggingItem,
    startDrag,
    cancelDrag,
    panHandlers: panResponder.panHandlers,
    setContainerRef: (r: View | null) => {
      containerRef.current = r;
      measureContainer();
    },
    setCellLayout: (index: number, layout: CellLayout) => {
      cellLayouts.current[index] = layout;
    },
    hoveredIndex,
  };
}


import { useEffect, useState, type DependencyList } from 'react';

type AsyncState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: Error };

export function useAsyncData<T>(loader: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    status: 'loading',
    data: null,
    error: null,
  });

  useEffect(() => {
    let isActive = true;

    setState({ status: 'loading', data: null, error: null });

    loader()
      .then((data) => {
        if (isActive) {
          setState({ status: 'success', data, error: null });
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setState({
            status: 'error',
            data: null,
            error: error instanceof Error ? error : new Error('データの読み込みに失敗しました'),
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, deps);

  return state;
}

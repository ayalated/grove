export type PaginationState = {
    pageIndex: number;
    pageCount: number;
    viewportWidth: number;
};

export type PaginationController = {
    getState: () => PaginationState;
    nextPage: () => PaginationState;
    prevPage: () => PaginationState;
    setPage: (index: number) => PaginationState;
    recalcLayout: (contentWidth: number, viewportWidth: number) => PaginationState;
    getTransform: () => string;
};

export function createPaginationController(): PaginationController {
    let state: PaginationState = {
        pageIndex: 0,
        pageCount: 1,
        viewportWidth: 0
    };

    function clampPage(index: number): number {
        const maxPage = Math.max(0, state.pageCount - 1);
        return Math.max(0, Math.min(index, maxPage));
    }

    function sync(next: Partial<PaginationState>): PaginationState {
        state = {
            ...state,
            ...next
        };
        state.pageIndex = clampPage(state.pageIndex);
        return state;
    }

    return {
        getState: () => state,
        nextPage: () => sync({ pageIndex: state.pageIndex + 1 }),
        prevPage: () => sync({ pageIndex: state.pageIndex - 1 }),
        setPage: (index: number) => sync({ pageIndex: index }),
        recalcLayout: (contentWidth: number, viewportWidth: number) => {
            if (viewportWidth <= 0) {
                return sync({ viewportWidth: 0, pageCount: 1, pageIndex: 0 });
            }

            const safeContentWidth = Math.max(contentWidth, viewportWidth);
            const pageCount = Math.max(1, Math.ceil(safeContentWidth / viewportWidth));
            return sync({ viewportWidth, pageCount });
        },
        getTransform: () => {
            if (state.viewportWidth <= 0) {
                return 'translate3d(0px, 0, 0)';
            }
            return `translate3d(${-state.pageIndex * state.viewportWidth}px, 0, 0)`;
        }
    };
}

/*---------------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------------*/

import React, { createContext, useContext } from 'react';

const ReadOnlyChatContext = createContext(false);

/** Marks nested chat UI (sub-agent popup) as display-only — no apply, approve, or abort actions. */
export const ReadOnlyChatProvider = ({ children }: { children: React.ReactNode }) => (
	<ReadOnlyChatContext.Provider value={true}>{children}</ReadOnlyChatContext.Provider>
);

export const useIsReadOnlyChat = (): boolean => useContext(ReadOnlyChatContext);

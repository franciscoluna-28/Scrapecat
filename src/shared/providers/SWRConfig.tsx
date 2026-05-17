"use client";

import { SWRConfig } from "swr";

type Props = {
  children: React.ReactNode;
};

export const SWRConfigProvider: React.FC<Props> = ({ children }) => {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        refreshInterval: 120000, // 2 minutes
        fetcher: (resource, init) =>
          fetch(resource, init).then((res) => res.json()),
      }}
    >
      {children}
    </SWRConfig>
  );
};

export default SWRConfigProvider;

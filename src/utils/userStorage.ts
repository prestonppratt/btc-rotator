interface UserLike {
  userId?: string;
  username?: string;
  signInDetails?: {
    loginId?: string;
  };
  attributes?: {
    email?: string;
  };
}

const toStorageKey = (id: string) => `portfolio_${id}`;

export const getPortfolioStorageKeys = (user: UserLike | null | undefined): string[] => {
  const ids = [
    user?.userId,
    user?.signInDetails?.loginId,
    user?.username,
    user?.attributes?.email,
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(ids.map(toStorageKey)));
};

export const getPrimaryPortfolioStorageKey = (user: UserLike | null | undefined): string => {
  const keys = getPortfolioStorageKeys(user);
  return keys[0] || 'portfolio_guest';
};

import React, { ChangeEvent, useCallback } from "react";
import { Box, Tab, Tabs } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import { usePage } from "../../state/page.state";
import { useKey } from "../../hooks/useKey";
import { useTabDisabledValue } from "../../state/keys.state";
import { useIsMenuVisibleValue } from "../../state/visibility.state";
import { useServerCtxValue } from "../../state/server.state";

const useStyles = makeStyles({
  tab: {
    minWidth: "100px",
  },
});

export const PageTabs: React.FC = () => {
  const classes = useStyles();
  const [page, setPage] = usePage();
  const tabDisabled = useTabDisabledValue();
  const visible = useIsMenuVisibleValue();
  const serverCtx = useServerCtxValue();

  const handleChange = (
    event: ChangeEvent<Record<string, never>>,
    newValue: number
  ) => {
    setPage(newValue);
  };

  const handleTabPress = useCallback(() => {
    if (tabDisabled || !visible) return;
    setPage((prevState) => (prevState + 1 > 2 ? 0 : prevState + 1));
  }, [tabDisabled, visible]);

  useKey(serverCtx.switchPageKey, handleTabPress);

  return (
    <Box width="100%">
      <Tabs
        value={page}
        centered
        indicatorColor="primary"
        textColor="secondary"
        onChange={handleChange}
      >
        <Tab className={classes.tab} label="Main" wrapped disableFocusRipple />
        <Tab
          className={classes.tab}
          label="Players"
          wrapped
          disableFocusRipple
        />
        <Tab
          className={classes.tab}
          label="txAdmin"
          wrapped
          disableFocusRipple
        />
      </Tabs>
    </Box>
  );
};

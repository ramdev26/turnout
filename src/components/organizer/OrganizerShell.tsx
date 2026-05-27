import React from 'react';
import { OrganizerFlowShell, type OrganizerFlowShellProps } from './OrganizerFlowShell';
import { organizerMainNav } from '../../utils/organizerNav';

type Props = Omit<OrganizerFlowShellProps, 'navLinks'> & {
  links?: OrganizerFlowShellProps['navLinks'];
};

/** @deprecated Use OrganizerFlowShell — kept for backward-compatible imports */
export const OrganizerShell: React.FC<Props> = ({ links, ...props }) => {
  return <OrganizerFlowShell navLinks={links ?? organizerMainNav} {...props} />;
};

export { OrganizerFlowShell };

import React from 'react';
import {URGENT_SUPPORT_MESSAGE,ABUSE_TECH_SAFETY} from '../../supabase/functions/_shared/urgent-support.ts';
export function UrgentHelp(){return <details className="urgentHelp"><summary>Ayuda urgente</summary><p>{URGENT_SUPPORT_MESSAGE}</p><p>{ABUSE_TECH_SAFETY}</p><p>SELF-IA no puede contactar con emergencias por ti ni vigilar tu seguridad. Esta información se abre sin llamar a la IA.</p></details>}

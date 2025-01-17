--Check Environment
if GetConvar('txAdminServerMode', 'false') ~= 'true' then
  return
end


ServerCtxObj = {
  oneSync = {
    type = nil,
    status = false
  },

  projectName = nil,
  maxClients = 30,
  locale = nil,
  localeData = nil,
  switchPageKey = '',
  txAdminVersion = '',
  alignRight = false
}


RegisterCommand('txAdmin-debug', function(src, args)
  if src > 0 then
    if not PlayerHasTxPermission(src, 'control.server') then
      return
    end
  end

  local playerName = (src > 0) and GetPlayerName(src) or 'Console'

  if not args[1] then
    return
  end

  if args[1] == '1' then
    debugModeEnabled = true
    debugPrint("^1!! Debug mode enabled by ^2" .. playerName .. "^1 !!^0")
    TriggerClientEvent('txAdmin:events:setDebugMode', -1, true)
  elseif args[1] == '0' then
    debugPrint("^1!! Debug mode disabled by ^2" .. playerName .. "^1 !!^0")
    debugModeEnabled = false
    TriggerClientEvent('txAdmin:events:setDebugMode', -1, false)
  end
end)


local function getCustomLocaleData()
  --Get convar
  local filePath = GetConvar('txAdmin-localeFile', 'false')
  if filePath == 'false' then
    return false
  end

  -- Get file data
  local fileHandle = io.open(filePath, "rb")
  if not fileHandle then 
    print('^1WARNING: failed to load custom locale from path: '..filePath)
    return false 
  end
  local fileData = fileHandle:read "*a"
  fileHandle:close()

  -- Parse and validate data
  local locale = json.decode(fileData)
  if 
    not locale 
    or type(locale['$meta']) ~= "table"
    or type(locale['nui_warning']) ~= "table"
    or type(locale['nui_menu']) ~= "table"
  then
    print('^1WARNING: load or validate custom locale JSON data from path: '..filePath)
    return false 
  end

  -- Build response
  debugPrint('^2Loaded custom locale file.')
  return {
    ['$meta'] = locale['$meta'],
    ['nui_warning'] = locale['nui_warning'],
    ['nui_menu'] = locale['nui_menu'],
  }
end


local function syncServerCtx()
  local oneSyncConvar = GetConvar('onesync', 'off')
  if oneSyncConvar == 'on' or oneSyncConvar == 'legacy' then
    ServerCtxObj.oneSync.type = oneSyncConvar
    ServerCtxObj.oneSync.status = true
  elseif oneSyncConvar == 'off' then
    ServerCtxObj.oneSync.type = nil
    ServerCtxObj.oneSync.status = false
  end

  -- Convar must match the event.code *EXACTLY* as shown on this site
  -- https://keycode.info/
  local switchPageKey = GetConvar('txAdminMenu-pageKey', 'Tab')
  ServerCtxObj.switchPageKey = switchPageKey

  local alignRight = GetConvarInt('txAdminMenu-alignRight', 0) > 0
  ServerCtxObj.alignRight = alignRight

  local txAdminVersion = GetConvar('txAdmin-version', '0.0.0')
  ServerCtxObj.txAdminVersion = txAdminVersion

  -- Default '' in fxServer
  local svProjectName = GetConvar('sv_projectname', '')
  if svProjectName ~= '' then
    ServerCtxObj.projectName = svProjectName
  end

  -- Default 30 in fxServer
  local svMaxClients = GetConvarInt('sv_maxclients', 30)
  ServerCtxObj.maxClients = svMaxClients

  -- Custom locale
  local txAdminLocale = GetConvar('txAdmin-locale', 'en')
  ServerCtxObj.locale = txAdminLocale
  if txAdminLocale == 'custom' then
    ServerCtxObj.localeData = getCustomLocaleData()
  else
    ServerCtxObj.localeData = false
  end

  debugPrint('Updated ServerCtx.')
  GlobalState.txAdminServerCtx = ServerCtxObj

  -- Telling admins that the server context changed
  for adminID, _ in pairs(TX_ADMINS) do
    TriggerClientEvent('txAdmin:events:setServerCtx', adminID, ServerCtxObj)
  end
end

RegisterNetEvent('txAdmin:events:getServerCtx', function()
  local src = source
  TriggerClientEvent('txAdmin:events:setServerCtx', src, ServerCtxObj)
end)

-- Everytime the txAdmin convars are changed this event will fire
-- Therefore, lets update global state with that.
AddEventHandler('txAdmin:events:configChanged', function()
  debugPrint('configChanged event triggered, syncing GlobalState')
  syncServerCtx()
end)


CreateThread(function()
  -- If we don't wait for a tick there is some race condition that
  -- sometimes prevents debugPrint lmao
  Wait(0)
  syncServerCtx()
end)

Set shell = CreateObject("WScript.Shell")
projectRoot = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
command = "cmd /c """ & projectRoot & "\start-backend.cmd"""
shell.Run command, 0, False

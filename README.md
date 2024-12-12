# SFT Time Logging Bot

This Discord bot allows users to log their time spent on activities, providing a convenient way to track and manage work hours.  It integrates with a Google Spreadsheet for persistent data storage and administrator review.

## Features

* **Time Logging:** Users can log their time using the `/log` command, specifying the duration in minutes and providing a link (e.g., to a project or task).
* **Time Viewing:** Users can view their logged time (approved, denied, pending) using the `/time` command. Administrators can view any user's time with `/time-admin`.
* **Log Approval/Denial:** Administrators can approve or deny logged time entries using the `/approve` and `/deny` commands, respectively.
* **Log Viewing (Admin):** Administrators can view all pending, accepted, or denied logs using `/viewpending`, `/viewaccepted`, and `/viewdenied`, respectively. They can also view details of a specific log with `/view`.
* **Hour Removal (Admin):** Administrators can remove approved hours from a user's record using the `/remove` command.
* **Spreadsheet Integration:**  All log entries and status updates are automatically synced to a Google Spreadsheet for persistent storage and easy access.
* **Cooldown:**  A configurable cooldown prevents users from spamming the `/log` command.
* **Shutdown (Admin):**  Administrators can shut down the bot using the `/shutdown` command.

## To Be Added
* **Service Hour Claim:** A claim system for service hours will be added in the near future.


Developed and sustained by Andrew + Shreyas

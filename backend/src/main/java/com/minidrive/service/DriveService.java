//package com.minidrive.service;
//
//import com.minidrive.db.DatabaseService; // For DbResult wrapper
//import com.minidrive.repository.FileRepository;
//import com.minidrive.repository.FolderRepository;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.stereotype.Service;
//
//@Service
//public class DriveService {
//
//	@Autowired private FileRepository fileRepo;
//	@Autowired private FolderRepository folderRepo;
//
//	public DatabaseService.DbResult deleteItem(String id, String username) {
//		// 1. Try Deleting File
//		if (fileRepo.deleteFile(id, username)) {
//			return DatabaseService.DbResult.success("File deleted", 1);
//		}
//		// 2. Try Deleting Folder
//		if (folderRepo.deleteFolder(id, username)) {
//			return DatabaseService.DbResult.success("Folder deleted", 1);
//		}
//		return DatabaseService.DbResult.failure("Item not found or access denied");
//	}
//}